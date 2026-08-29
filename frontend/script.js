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
        const resposta = await fetch("https://martins-atelie-api.onrender.com/vestidos");

        const vestidos = await resposta.json();

        const productsGrid = document.getElementById("productsGrid");

        productsGrid.innerHTML = "";

        vestidos.forEach((vestido) => {
            const card = document.createElement("article");
            const productImage = document.createElement("div");
            const image = document.createElement("img");
            const tag = document.createElement("span");
            const button = document.createElement("button");
            const productInfo = document.createElement("div");
            const category = document.createElement("span");
            const name = document.createElement("h3");
            const description = document.createElement("p");

            card.className = "product-card";
            card.dataset.category = vestido.categoria;

            productImage.className = "product-image";
            image.src = vestido.imagem_url || "https://via.placeholder.com/900x1200";
            image.alt = vestido.nome;

            tag.className = "product-tag";
            tag.textContent = vestido.categoria;

            button.type = "button";
            button.className = "view-product";
            button.dataset.name = vestido.nome;
            button.dataset.category = vestido.categoria;
            button.dataset.description = vestido.descricao || "";
            button.textContent = "Ver detalhes";

            productImage.append(image, tag, button);

            productInfo.className = "product-info";
            category.textContent = vestido.categoria.toUpperCase();
            name.textContent = vestido.nome;
            description.textContent = vestido.descricao || "";
            productInfo.append(category, name, description);

            card.append(productImage, productInfo);

            productsGrid.appendChild(card);
        });

        products = Array.from(
            productsGrid.querySelectorAll(".product-card")
        );

    } catch (erro) {
        console.error("Erro ao carregar vestidos:", erro);

        const productsGrid = document.getElementById("productsGrid");
        productsGrid.innerHTML = "";

        const message = document.createElement("p");
        message.className = "products-error";
        message.textContent = "Não foi possível carregar os vestidos. Tente novamente mais tarde.";

        productsGrid.appendChild(message);
    }
}

carregarVestidos();
