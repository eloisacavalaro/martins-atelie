/* =========================================
   MENU MOBILE
========================================= */

const menuBtn = document.getElementById("menuBtn");
const navMenu = document.getElementById("navMenu");

menuBtn.addEventListener("click", () => {
  navMenu.classList.toggle("active");

  const icon = menuBtn.querySelector("i");

  if (navMenu.classList.contains("active")) {
    icon.classList.remove("fa-bars");

    icon.classList.add("fa-xmark");
  } else {
    icon.classList.remove("fa-xmark");

    icon.classList.add("fa-bars");
  }
});

/* Fechar menu ao clicar em um link */

document.querySelectorAll("nav a").forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("active");

    const icon = menuBtn.querySelector("i");

    icon.classList.remove("fa-xmark");

    icon.classList.add("fa-bars");
  });
});

/* =========================================
   FILTRO DA VITRINE
========================================= */

const filters = document.querySelectorAll(".filter");
let products = [];


filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    filters.forEach((item) => {
      item.classList.remove("active");
    });

    filter.classList.add("active");

    const category = filter.dataset.filter;

    products.forEach((product) => {
      if (category === "todos" || product.dataset.category === category) {
        product.style.display = "block";

        setTimeout(() => {
          product.style.opacity = "1";
          product.style.transform = "translateY(0)";
        }, 20);
      } else {
        product.style.opacity = "0";
        product.style.transform = "translateY(10px)";

        setTimeout(() => {
          product.style.display = "none";
        }, 200);
      }
    });
  });
});

/* =========================================
   CATEGORIAS
========================================= */

const categoryCards = document.querySelectorAll(".category-card");

categoryCards.forEach((card) => {
  card.addEventListener("click", () => {
    const category = card.dataset.category;

    const filter = document.querySelector(`.filter[data-filter="${category}"]`);

    if (filter) {
      filter.click();
    }

    document.getElementById("colecao").scrollIntoView({
      behavior: "smooth",
    });
  });
});

/* =========================================
   MODAL DE PRODUTO
========================================= */

const modal = document.getElementById("productModal");

const modalClose = document.getElementById("modalClose");

const modalName = document.getElementById("modalName");

const modalCategory = document.getElementById("modalCategory");

const modalDescription = document.getElementById("modalDescription");

const modalSchedule = document.getElementById("modalSchedule");

document.getElementById("productsGrid").addEventListener("click", (event) => {
  const button = event.target.closest(".view-product");

  if (!button) return;

  const name = button.dataset.name;
  const category = button.dataset.category;
  const description = button.dataset.description;

  modalName.textContent = name;
  modalCategory.textContent = category.toUpperCase();
  modalDescription.textContent = description;

  modal.classList.add("show");

  document.body.style.overflow = "hidden";
});

function closeModal() {
  modal.classList.remove("show");

  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("show")) {
    closeModal();
  }
});

/* =========================================
   MODAL -> AGENDAMENTO
========================================= */

modalSchedule.addEventListener("click", () => {
  closeModal();
});

/* =========================================
   FORMULÁRIO
========================================= */


/* =========================================
   BOTÃO VOLTAR AO TOPO
========================================= */

const backTop = document.getElementById("backTop");

window.addEventListener("scroll", () => {
  if (window.scrollY > 500) {
    backTop.classList.add("show");
  } else {
    backTop.classList.remove("show");
  }
});

backTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});

/* =========================================
   ANIMAÇÃO DOS PRODUTOS
========================================= */

/*const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";

        entry.target.style.transform = "translateY(0)";

        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.1,
  },
);

products.forEach((product) => {
  product.style.opacity = "0";

  product.style.transform = "translateY(20px)";

  product.style.transition = "opacity 0.6s ease, transform 0.6s ease";

  observer.observe(product);
});*/
async function carregarVestidos() {
    try {
        const resposta = await fetch("http://localhost:3000/vestidos");

        const vestidos = await resposta.json();

        const productsGrid = document.getElementById("productsGrid");

        productsGrid.innerHTML = "";

        vestidos.forEach((vestido) => {
            const card = document.createElement("article");

            card.className = "product-card";
            card.dataset.category = vestido.categoria;

            card.innerHTML = `
                <div class="product-image">

                    <img
                        src="${vestido.imagem_url || "https://via.placeholder.com/900x1200"}"
                        alt="${vestido.nome}"
                    >

                    <span class="product-tag">
                        ${vestido.categoria}
                    </span>

                    <button
                        class="view-product"
                        data-name="${vestido.nome}"
                        data-category="${vestido.categoria}"
                        data-description="${vestido.descricao || ""}"
                    >
                        Ver detalhes
                    </button>

                </div>

                <div class="product-info">

                    <span>
                        ${vestido.categoria.toUpperCase()}
                    </span>

                    <h3>
                        ${vestido.nome}
                    </h3>

                    <p>
                        ${vestido.descricao || ""}
                    </p>

                </div>
            `;

            productsGrid.appendChild(card);
        });

        products = Array.from(
            productsGrid.querySelectorAll(".product-card")
        );

    } catch (erro) {
        console.error("Erro ao carregar vestidos:", erro);
    }
}

carregarVestidos();