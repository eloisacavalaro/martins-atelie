const express = require("express");
const pool = require("./db");
const Joi = require("joi");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(express.json());

const vestidoSchema = Joi.object({
    nome: Joi.string().trim().min(2).max(100).required(),
    categoria: Joi.string().trim().min(2).max(50).required(),
    tamanho: Joi.string().trim().max(20).allow(""),
    cor: Joi.string().trim().max(50).allow(""),
    descricao: Joi.string().trim().max(500).allow(""),
    preco_aluguel: Joi.number().positive().required(),
    confeccionado: Joi.boolean().default(false),
    imagem_url: Joi.string().uri().allow(""),
    disponivel: Joi.boolean().default(true)
});

const clienteSchema = Joi.object({
    nome: Joi.string().trim().min(2).max(100).required(),
    telefone: Joi.string().trim().max(30).allow(""),
    email: Joi.string().trim().email().max(150).allow(""),
    observacoes: Joi.string().trim().max(500).allow("")
});

const agendamentoSchema = Joi.object({
    cliente_id: Joi.number().integer().positive().required(),
    data_hora: Joi.date().iso().required(),
    categoria: Joi.string().trim().min(2).max(50).required(),
    observacoes: Joi.string().trim().max(500).allow(""),
    status: Joi.string()
        .valid("pendente", "confirmado", "cancelado", "concluido")
        .default("pendente")
});

const aluguelSchema = Joi.object({
    cliente_id: Joi.number().integer().positive().required(),
    vestido_id: Joi.number().integer().positive().required(),
    data_retirada: Joi.date().iso().required(),
    data_devolucao: Joi.date().iso().required(),
    valor_aluguel: Joi.number().positive().required(),
    valor_ajuste: Joi.number().min(0).default(0),
    valor_mao_obra: Joi.number().min(0).default(0),
    status: Joi.string()
        .valid("reservado", "retirado", "devolvido", "cancelado")
        .default("reservado"),
    observacoes: Joi.string().trim().max(500).allow("")
});

const pagamentoSchema = Joi.object({
    aluguel_id: Joi.number().integer().positive().required(),
    valor: Joi.number().positive().required(),
    forma_pagamento: Joi.string()
        .valid("dinheiro", "pix", "cartao_credito", "cartao_debito")
        .required(),
    parcelas: Joi.number().integer().min(1).default(1),
    data_pagamento: Joi.date().iso().default(() => new Date()),
    observacoes: Joi.string().trim().max(500).allow("")
});

const despesaSchema = Joi.object({
    descricao: Joi.string().trim().min(2).max(200).required(),
    categoria: Joi.string().trim().min(2).max(100).required(),
    valor: Joi.number().positive().required(),
    data_despesa: Joi.date().iso().required(),
    observacoes: Joi.string().trim().max(500).allow("")
});

const loginSchema = Joi.object({
    email: Joi.string().trim().email().max(150).required(),
    senha: Joi.string().min(8).max(100).required()
});

const idSchema = Joi.number().integer().positive().required();

const PORT = process.env.PORT || 3000;


const corsOptions = {
    origin: "https://martins-atelie-api.onrender.com"
};

app.use(cors(corsOptions));
app.use(helmet());

const limiteGeral = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        erro: "Muitas requisições. Tente novamente mais tarde."
    }
});

app.use(limiteGeral);


const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        erro: "Muitas tentativas de login. Tente novamente mais tarde."
    }
});

function autenticar(req, res, next) {
    try {
        const autorizacao = req.headers.authorization;

        if (!autorizacao) {
            return res.status(401).json({
                erro: "Token não informado"
            });
        }

        const partes = autorizacao.split(" ");

        if (partes.length !== 2 || partes[0] !== "Bearer") {
            return res.status(401).json({
                erro: "Formato de token inválido"
            });
        }

        const token = partes[1];

        const usuario = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.usuario = usuario;

        next();

    } catch (erro) {
        return res.status(401).json({
            erro: "Token inválido ou expirado"
        });
    }
}

function apenasAdmin(req, res, next) {
    if (!req.usuario || req.usuario.perfil !== "admin") {
        return res.status(403).json({
            erro: "Acesso negado"
        });
    }

    next();
}

app.get("/", (req, res) => {
    res.json({
        mensagem: "API da Martins Atelie funcionando!"
    });
});

app.get("/teste-banco", async (req, res, next) => {
    try {
        const resultado = await pool.query("SELECT NOW()");

        res.json({
            mensagem: "Banco conectado!",
            horario: resultado.rows[0]
        });

    } catch (erro) {
        next(erro);
    }
});

app.get("/vestidos", async (req, res, next) => {
    try {
        const resultado = await pool.query(
            "SELECT * FROM vestidos ORDER BY id"
        );

        res.json(resultado.rows);

    } catch (erro) {
        next(erro);
    }
});

app.get("/vestidos/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const { error } = idSchema.validate(id);

            if (error) {
                return res.status(400).json({
                    erro: "ID inválido"
                });
            }

        const resultado = await pool.query(
            "SELECT * FROM vestidos WHERE id = $1",
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Vestido não encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.put("/vestidos/:id",autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

            if (error) {
                return res.status(400).json({
                    erro: "ID inválido"
                });
            }

        const {
            nome,
            categoria,
            tamanho,
            cor,
            descricao,
            preco_aluguel,
            confeccionado,
            imagem_url,
            disponivel
        } = req.body;

       const resultado = await pool.query(
            `UPDATE vestidos
            SET nome = $1,
                categoria = $2,
                tamanho = $3,
                cor = $4,
                descricao = $5,
                preco_aluguel = $6,
                confeccionado = $7,
                imagem_url = $8,
                disponivel = $9
            WHERE id = $10
            RETURNING *`,
            [
                nome,
                categoria,
                tamanho,
                cor,
                descricao,
                preco_aluguel,
                confeccionado,
                imagem_url,
                disponivel,
                id
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Vestido não encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.post("/vestidos",autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { error, value } = vestidoSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            nome,
            categoria,
            tamanho,
            cor,
            descricao,
            preco_aluguel,
            confeccionado,
            imagem_url,
            disponivel
        } = value;

        const resultado = await pool.query(
            `INSERT INTO vestidos
            (
                nome,
                categoria,
                tamanho,
                cor,
                descricao,
                preco_aluguel,
                confeccionado,
                imagem_url,
                disponivel
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *`,
            [
                nome,
                categoria,
                tamanho,
                cor,
                descricao,
                preco_aluguel,
                confeccionado,
                imagem_url,
                disponivel
            ]
        );

        res.status(201).json(resultado.rows[0]);

    }  catch (erro) {
        next(erro);
    }
});

app.post("/agendamentos",async (req, res, next) => {
    try {
        const { error, value } = agendamentoSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            cliente_id,
            data_hora,
            categoria,
            observacoes,
            status
        } = value;

        const cliente = await pool.query(
            "SELECT id FROM clientes WHERE id = $1",
            [cliente_id]
        );

        if (cliente.rows.length === 0) {
            return res.status(404).json({
                erro: "Cliente não encontrada"
            });
        }

        const resultado = await pool.query(
            `INSERT INTO agendamentos
            (cliente_id, data_hora, categoria, observacoes, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                cliente_id,
                data_hora,
                categoria,
                observacoes,
                status
            ]
        );

        res.status(201).json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.delete("/vestidos/:id",autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

            if (error) {
                return res.status(400).json({
                    erro: "ID inválido"
                });
            }

        const resultado = await pool.query(
            "DELETE FROM vestidos WHERE id = $1 RETURNING *",
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Vestido não encontrado"
            });
        }

        res.json({
            mensagem: "Vestido excluído com sucesso",
            vestido: resultado.rows[0]
        });

    } catch (erro) {
        next(erro);
    }
});
app.post("/login", limiteLogin, async (req, res, next) => {
    try {
        const { error, value } = loginSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados de login inválidos"
            });
        }

        const { email, senha } = value;

        const resultado = await pool.query(
            "SELECT * FROM usuarios WHERE email = $1",
            [email]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                erro: "Email ou senha inválidos"
            });
        }

        const usuario = resultado.rows[0];

        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.senha
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                erro: "Email ou senha inválidos"
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                perfil: usuario.perfil
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        res.json({
            mensagem: "Login realizado com sucesso",
            token
        });

    } catch (erro) {
        next(erro);
    }
});

app.post("/clientes", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { error, value } = clienteSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            nome,
            telefone,
            email,
            observacoes
        } = value;

        const resultado = await pool.query(
            `INSERT INTO clientes
            (nome, telefone, email, observacoes)
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [
                nome,
                telefone,
                email,
                observacoes
            ]
        );

        res.status(201).json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.get("/clientes", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const resultado = await pool.query(
            "SELECT * FROM clientes ORDER BY id DESC"
        );

        res.json(resultado.rows);

    } catch (erro) {
        next(erro);
    }
});

app.get("/clientes/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            "SELECT * FROM clientes WHERE id = $1",
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Cliente não encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});
app.put("/clientes/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error: erroId } = idSchema.validate(id);

        if (erroId) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const { error, value } = clienteSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            nome,
            telefone,
            email,
            observacoes
        } = value;

        const resultado = await pool.query(
            `UPDATE clientes
             SET nome = $1,
                 telefone = $2,
                 email = $3,
                 observacoes = $4
             WHERE id = $5
             RETURNING *`,
            [
                nome,
                telefone,
                email,
                observacoes,
                id
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Cliente não encontrada"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.delete("/clientes/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            "DELETE FROM clientes WHERE id = $1 RETURNING *",
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Cliente não encontrada"
            });
        }

        res.json({
            mensagem: "Cliente excluída com sucesso",
            cliente: resultado.rows[0]
        });

    } catch (erro) {
        next(erro);
    }
});

app.get("/agendamentos", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT 
                a.id,
                a.cliente_id,
                c.nome AS cliente_nome,
                a.data_hora,
                a.categoria,
                a.observacoes,
                a.status,
                a.criado_em
             FROM agendamentos a
             INNER JOIN clientes c ON c.id = a.cliente_id
             ORDER BY a.data_hora ASC`
        );

        res.json(resultado.rows);

    } catch (erro) {
        next(erro);
    }
});
app.get("/agendamentos/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            `SELECT
                a.id,
                a.cliente_id,
                c.nome AS cliente_nome,
                a.data_hora,
                a.categoria,
                a.observacoes,
                a.status,
                a.criado_em
             FROM agendamentos a
             INNER JOIN clientes c ON c.id = a.cliente_id
             WHERE a.id = $1`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Agendamento não encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.put("/agendamentos/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error: erroId } = idSchema.validate(id);

        if (erroId) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const { error, value } = agendamentoSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            cliente_id,
            data_hora,
            categoria,
            observacoes,
            status
        } = value;

        const cliente = await pool.query(
            "SELECT id FROM clientes WHERE id = $1",
            [cliente_id]
        );

        if (cliente.rows.length === 0) {
            return res.status(404).json({
                erro: "Cliente não encontrada"
            });
        }

        const resultado = await pool.query(
            `UPDATE agendamentos
             SET cliente_id = $1,
                 data_hora = $2,
                 categoria = $3,
                 observacoes = $4,
                 status = $5
             WHERE id = $6
             RETURNING *`,
            [
                cliente_id,
                data_hora,
                categoria,
                observacoes,
                status,
                id
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Agendamento não encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.delete("/agendamentos/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            "DELETE FROM agendamentos WHERE id = $1 RETURNING *",
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Agendamento não encontrado"
            });
        }

        res.json({
            mensagem: "Agendamento excluído com sucesso",
            agendamento: resultado.rows[0]
        });

    } catch (erro) {
        next(erro);
    }
});

app.post("/alugueis", autenticar, apenasAdmin, async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { error, value } = aluguelSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            cliente_id,
            vestido_id,
            data_retirada,
            data_devolucao,
            valor_aluguel,
            valor_ajuste,
            valor_mao_obra,
            status,
            observacoes
        } = value;

        if (new Date(data_devolucao) < new Date(data_retirada)) {
            return res.status(400).json({
                erro: "A data de devolução não pode ser anterior à data de retirada"
            });
        }

        // Inicia a transação
        await client.query("BEGIN");

        const cliente = await client.query(
            "SELECT id FROM clientes WHERE id = $1",
            [cliente_id]
        );

        if (cliente.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                erro: "Cliente não encontrada"
            });
        }

        const vestido = await client.query(
            "SELECT id, disponivel FROM vestidos WHERE id = $1",
            [vestido_id]
        );

        if (vestido.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                erro: "Vestido não encontrado"
            });
        }

        if (!vestido.rows[0].disponivel) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                erro: "Vestido não está disponível"
            });
        }

        const conflito = await client.query(
            `SELECT id
             FROM alugueis
             WHERE vestido_id = $1
             AND status <> 'cancelado'
             AND data_retirada <= $3
             AND data_devolucao >= $2`,
            [
                vestido_id,
                data_retirada,
                data_devolucao
            ]
        );

        if (conflito.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                erro: "Vestido já está alugado nesse período"
            });
        }

        const valor_total =
            Number(valor_aluguel) +
            Number(valor_ajuste) +
            Number(valor_mao_obra);

        const resultado = await client.query(
            `INSERT INTO alugueis
            (
                cliente_id,
                vestido_id,
                data_retirada,
                data_devolucao,
                valor_aluguel,
                valor_ajuste,
                valor_mao_obra,
                valor_total,
                status,
                observacoes
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *`,
            [
                cliente_id,
                vestido_id,
                data_retirada,
                data_devolucao,
                valor_aluguel,
                valor_ajuste,
                valor_mao_obra,
                valor_total,
                status,
                observacoes
            ]
        );

        await client.query(
            `UPDATE vestidos
             SET disponivel = false
             WHERE id = $1`,
            [vestido_id]
        );

        // Confirma todas as alterações
        await client.query("COMMIT");

        res.status(201).json(resultado.rows[0]);

    } catch (erro) {

        // Desfaz tudo caso alguma operação falhe
        try {
            await client.query("ROLLBACK");
        } catch (erroRollback) {
            console.error("Erro ao executar ROLLBACK:", erroRollback);
        }

        next(erro);

    } finally {

        // Libera a conexão de volta para o pool
        client.release();
    }
});

app.get("/alugueis", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT
                a.id,
                a.cliente_id,
                c.nome AS cliente_nome,
                a.vestido_id,
                v.nome AS vestido_nome,
                a.data_retirada,
                a.data_devolucao,
                a.valor_aluguel,
                a.valor_ajuste,
                a.valor_mao_obra,
                a.valor_total,
                a.status,
                a.observacoes,
                a.criado_em
             FROM alugueis a
             INNER JOIN clientes c ON c.id = a.cliente_id
             INNER JOIN vestidos v ON v.id = a.vestido_id
             ORDER BY a.data_retirada ASC`
        );

        res.json(resultado.rows);

    } catch (erro) {
        next(erro);
    }
});

app.get("/alugueis/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            `SELECT
                a.id,
                a.cliente_id,
                c.nome AS cliente_nome,
                a.vestido_id,
                v.nome AS vestido_nome,
                a.data_retirada,
                a.data_devolucao,
                a.valor_aluguel,
                a.valor_ajuste,
                a.valor_mao_obra,
                a.valor_total,
                a.status,
                a.observacoes,
                a.criado_em
             FROM alugueis a
             INNER JOIN clientes c ON c.id = a.cliente_id
             INNER JOIN vestidos v ON v.id = a.vestido_id
             WHERE a.id = $1`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Aluguel não encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.put("/alugueis/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error: erroId } = idSchema.validate(id);

        const aluguelAtual = await pool.query(
            `SELECT vestido_id
            FROM alugueis
            WHERE id = $1`,
            [id]
        );

        if (aluguelAtual.rows.length === 0) {
            return res.status(404).json({
                erro: "Aluguel não encontrado"
            });
        }

        const vestidoAntigo = aluguelAtual.rows[0].vestido_id;

        if (erroId) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const { error, value } = aluguelSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            cliente_id,
            vestido_id,
            data_retirada,
            data_devolucao,
            valor_aluguel,
            valor_ajuste,
            valor_mao_obra,
            status,
            observacoes
        } = value;

        if (new Date(data_devolucao) < new Date(data_retirada)) {
            return res.status(400).json({
                erro: "A data de devolução não pode ser anterior à data de retirada"
            });
        }

        const cliente = await pool.query(
            "SELECT id FROM clientes WHERE id = $1",
            [cliente_id]
        );

        if (cliente.rows.length === 0) {
            return res.status(404).json({
                erro: "Cliente não encontrada"
            });
        }

        const vestido = await pool.query(
            "SELECT id FROM vestidos WHERE id = $1",
            [vestido_id]
        );

        if (vestido.rows.length === 0) {
            return res.status(404).json({
                erro: "Vestido não encontrado"
            });
        }
        const conflito = await pool.query(
            `SELECT id
            FROM alugueis
            WHERE vestido_id = $1
            AND id <> $2
            AND status <> 'cancelado'
            AND data_retirada <= $4
            AND data_devolucao >= $3`,
            [
                vestido_id,
                id,
                data_retirada,
                data_devolucao
            ]
        );

        if (conflito.rows.length > 0) {
            return res.status(400).json({
                erro: "Vestido já está alugado nesse período"
            });
        }

        const valor_total =
            Number(valor_aluguel) +
            Number(valor_ajuste) +
            Number(valor_mao_obra);

        const resultado = await pool.query(
            `UPDATE alugueis
             SET cliente_id = $1,
                 vestido_id = $2,
                 data_retirada = $3,
                 data_devolucao = $4,
                 valor_aluguel = $5,
                 valor_ajuste = $6,
                 valor_mao_obra = $7,
                 valor_total = $8,
                 status = $9,
                 observacoes = $10
             WHERE id = $11
             RETURNING *`,
            [
                cliente_id,
                vestido_id,
                data_retirada,
                data_devolucao,
                valor_aluguel,
                valor_ajuste,
                valor_mao_obra,
                valor_total,
                status,
                observacoes,
                id
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Aluguel não encontrado"
            });
        }

        if (vestidoAntigo !== vestido_id) {
            await pool.query(
                `UPDATE vestidos
                SET disponivel = true
                WHERE id = $1`,
                [vestidoAntigo]
            );

            if (status !== "cancelado" && status !== "devolvido") {
                await pool.query(
                    `UPDATE vestidos
                    SET disponivel = false
                    WHERE id = $1`,
                    [vestido_id]
                );
            }
        }

        if (status === "cancelado" || status === "devolvido") {
            await pool.query(
                `UPDATE vestidos
                SET disponivel = true
                WHERE id = $1`,
                [vestido_id]
            );
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.delete("/alugueis/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            "DELETE FROM alugueis WHERE id = $1 RETURNING *",
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Aluguel não encontrado"
            });
        }

        res.json({
            mensagem: "Aluguel excluído com sucesso",
            aluguel: resultado.rows[0]
        });

    } catch (erro) {
        next(erro);
    }
});

app.post("/pagamentos", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { error, value } = pagamentoSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            aluguel_id,
            valor,
            forma_pagamento,
            parcelas,
            data_pagamento,
            observacoes
        } = value;

        const aluguel = await pool.query(
            "SELECT id, valor_total FROM alugueis WHERE id = $1",
            [aluguel_id]
        );

        if (aluguel.rows.length === 0) {
            return res.status(404).json({
                erro: "Aluguel não encontrado"
            });
        }

        const resultado = await pool.query(
            `INSERT INTO pagamentos
            (
                aluguel_id,
                valor,
                forma_pagamento,
                parcelas,
                data_pagamento,
                observacoes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                aluguel_id,
                valor,
                forma_pagamento,
                parcelas,
                data_pagamento,
                observacoes
            ]
        );

        res.status(201).json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.get("/pagamentos", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT
                p.id,
                p.aluguel_id,
                c.nome AS cliente_nome,
                v.nome AS vestido_nome,
                p.valor,
                p.forma_pagamento,
                p.parcelas,
                p.data_pagamento,
                p.observacoes
             FROM pagamentos p
             INNER JOIN alugueis a ON a.id = p.aluguel_id
             INNER JOIN clientes c ON c.id = a.cliente_id
             INNER JOIN vestidos v ON v.id = a.vestido_id
             ORDER BY p.data_pagamento DESC`
        );

        res.json(resultado.rows);

    } catch (erro) {
        next(erro);
    }
});

app.get("/pagamentos/aluguel/:aluguel_id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { aluguel_id } = req.params;

        const { error } = idSchema.validate(aluguel_id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const aluguel = await pool.query(
            `SELECT
                id,
                valor_total
             FROM alugueis
             WHERE id = $1`,
            [aluguel_id]
        );

        if (aluguel.rows.length === 0) {
            return res.status(404).json({
                erro: "Aluguel não encontrado"
            });
        }

        const pagamentos = await pool.query(
            `SELECT *
             FROM pagamentos
             WHERE aluguel_id = $1
             ORDER BY data_pagamento ASC`,
            [aluguel_id]
        );

        const valorTotal = Number(aluguel.rows[0].valor_total);

        const totalPago = pagamentos.rows.reduce(
            (total, pagamento) => total + Number(pagamento.valor),
            0
        );

        const restante = valorTotal - totalPago;

        let statusPagamento;

        if (totalPago === 0) {
            statusPagamento = "pendente";
        } else if (totalPago >= valorTotal) {
            statusPagamento = "pago";
        } else {
            statusPagamento = "parcial";
        }

        res.json({
            aluguel_id: Number(aluguel_id),
            valor_total: valorTotal,
            total_pago: totalPago,
            restante: restante,
            status_pagamento: statusPagamento,
            pagamentos: pagamentos.rows
        });

    } catch (erro) {
        next(erro);
    }
});

app.get("/pagamentos/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            `SELECT
                p.id,
                p.aluguel_id,
                c.nome AS cliente_nome,
                v.nome AS vestido_nome,
                p.valor,
                p.forma_pagamento,
                p.parcelas,
                p.data_pagamento,
                p.observacoes
             FROM pagamentos p
             INNER JOIN alugueis a ON a.id = p.aluguel_id
             INNER JOIN clientes c ON c.id = a.cliente_id
             INNER JOIN vestidos v ON v.id = a.vestido_id
             WHERE p.id = $1`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Pagamento não encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.put("/pagamentos/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error: erroId } = idSchema.validate(id);

        if (erroId) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const { error, value } = pagamentoSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            aluguel_id,
            valor,
            forma_pagamento,
            parcelas,
            data_pagamento,
            observacoes
        } = value;

        const aluguel = await pool.query(
            "SELECT id FROM alugueis WHERE id = $1",
            [aluguel_id]
        );

        if (aluguel.rows.length === 0) {
            return res.status(404).json({
                erro: "Aluguel não encontrado"
            });
        }

        const resultado = await pool.query(
            `UPDATE pagamentos
             SET aluguel_id = $1,
                 valor = $2,
                 forma_pagamento = $3,
                 parcelas = $4,
                 data_pagamento = $5,
                 observacoes = $6
             WHERE id = $7
             RETURNING *`,
            [
                aluguel_id,
                valor,
                forma_pagamento,
                parcelas,
                data_pagamento,
                observacoes,
                id
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Pagamento não encontrado"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.delete("/pagamentos/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            "DELETE FROM pagamentos WHERE id = $1 RETURNING *",
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Pagamento não encontrado"
            });
        }

        res.json({
            mensagem: "Pagamento excluído com sucesso",
            pagamento: resultado.rows[0]
        });

    } catch (erro) {
        next(erro);
    }
});

app.post("/despesas", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { error, value } = despesaSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            descricao,
            categoria,
            valor,
            data_despesa,
            observacoes
        } = value;

        const resultado = await pool.query(
            `INSERT INTO despesas
            (
                descricao,
                categoria,
                valor,
                data_despesa,
                observacoes
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                descricao,
                categoria,
                valor,
                data_despesa,
                observacoes
            ]
        );

        res.status(201).json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.get("/despesas", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `SELECT *
             FROM despesas
             ORDER BY data_despesa DESC`
        );

        res.json(resultado.rows);

    } catch (erro) {
        next(erro);
    }
});

app.get("/despesas/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            `SELECT *
             FROM despesas
             WHERE id = $1`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Despesa não encontrada"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.put("/despesas/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error: erroId } = idSchema.validate(id);

        if (erroId) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const { error, value } = despesaSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                erro: "Dados inválidos",
                detalhes: error.details.map((detalhe) => detalhe.message)
            });
        }

        const {
            descricao,
            categoria,
            valor,
            data_despesa,
            observacoes
        } = value;

        const resultado = await pool.query(
            `UPDATE despesas
             SET descricao = $1,
                 categoria = $2,
                 valor = $3,
                 data_despesa = $4,
                 observacoes = $5
             WHERE id = $6
             RETURNING *`,
            [
                descricao,
                categoria,
                valor,
                data_despesa,
                observacoes,
                id
            ]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Despesa não encontrada"
            });
        }

        res.json(resultado.rows[0]);

    } catch (erro) {
        next(erro);
    }
});

app.delete("/despesas/:id", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = idSchema.validate(id);

        if (error) {
            return res.status(400).json({
                erro: "ID inválido"
            });
        }

        const resultado = await pool.query(
            "DELETE FROM despesas WHERE id = $1 RETURNING *",
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                erro: "Despesa não encontrada"
            });
        }

        res.json({
            mensagem: "Despesa excluída com sucesso",
            despesa: resultado.rows[0]
        });

    } catch (erro) {
        next(erro);
    }
});

app.get("/financeiro/resumo", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { inicio, fim } = req.query;

        let filtroPagamentos = "";
        let filtroDespesas = "";
        let filtroAlugueis = "";

        const parametros = [];

        if (inicio && fim) {
            filtroPagamentos = "AND p.data_pagamento::date BETWEEN $1 AND $2";
            filtroDespesas = "AND d.data_despesa::date BETWEEN $1 AND $2";
            filtroAlugueis = "AND a.data_retirada BETWEEN $1 AND $2";

            parametros.push(inicio, fim);
        }

        const pagamentos = await pool.query(
            `SELECT COALESCE(SUM(p.valor), 0) AS total
             FROM pagamentos p
             WHERE 1=1
             ${filtroPagamentos}`,
            parametros
        );

        const despesas = await pool.query(
            `SELECT COALESCE(SUM(d.valor), 0) AS total
             FROM despesas d
             WHERE 1=1
             ${filtroDespesas}`,
            parametros
        );

        const alugueis = await pool.query(
            `SELECT COUNT(*) AS quantidade
             FROM alugueis a
             WHERE a.status <> 'cancelado'
             ${filtroAlugueis}`,
            parametros
        );

        const quantidadePagamentos = await pool.query(
            `SELECT COUNT(*) AS quantidade
             FROM pagamentos p
             WHERE 1=1
             ${filtroPagamentos}`,
            parametros
        );

        const receita = Number(pagamentos.rows[0].total);
        const totalDespesas = Number(despesas.rows[0].total);
        const lucro = receita - totalDespesas;

        res.json({
            receita,
            despesas: totalDespesas,
            lucro,
            quantidade_alugueis: Number(alugueis.rows[0].quantidade),
            quantidade_pagamentos: Number(
                quantidadePagamentos.rows[0].quantidade
            )
        });

    } catch (erro) {
        next(erro);
    }
});


app.get("/financeiro/receitas", autenticar, apenasAdmin, async (req, res, next) => {
    try {
        const { inicio, fim, forma_pagamento } = req.query;

        let filtros = [];
        let parametros = [];

        if (inicio) {
            parametros.push(inicio);
            filtros.push(`p.data_pagamento::date >= $${parametros.length}`);
        }

        if (fim) {
            parametros.push(fim);
            filtros.push(`p.data_pagamento::date <= $${parametros.length}`);
        }

        if (forma_pagamento) {
            parametros.push(forma_pagamento);
            filtros.push(`p.forma_pagamento = $${parametros.length}`);
        }

        const where = filtros.length > 0
            ? `WHERE ${filtros.join(" AND ")}`
            : "";

        const resultado = await pool.query(
            `SELECT
                p.id AS pagamento_id,
                c.nome AS cliente_nome,
                v.nome AS vestido_nome,
                p.valor,
                p.forma_pagamento,
                p.parcelas,
                p.data_pagamento,
                p.observacoes
             FROM pagamentos p
             INNER JOIN alugueis a ON a.id = p.aluguel_id
             INNER JOIN clientes c ON c.id = a.cliente_id
             INNER JOIN vestidos v ON v.id = a.vestido_id
             ${where}
             ORDER BY p.data_pagamento DESC`,
            parametros
        );

        res.json(resultado.rows);

    } catch (erro) {
        next(erro);
    }
});

// Middleware central de erros
app.use((erro, req, res, next)=>{
    console.error("ERRO:", erro);

    res.status(500).json({
        erro: "Erro interno do servidor"
    });
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});