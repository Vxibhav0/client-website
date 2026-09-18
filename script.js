const cart = JSON.parse(localStorage.getItem("hotNColdCart")) || [];

const menuGrid = document.getElementById("menuGrid");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

function saveCart() {
  localStorage.setItem("hotNColdCart", JSON.stringify(cart));
}

function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.add("visible");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  overlay.classList.remove("visible");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function showToast(message) {
  toastText.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2300);
}

function renderCart() {
  if (!cart.length) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <span>☕</span>
        <h3>Your cart is empty</h3>
        <p>Add something delicious from the menu.</p>
      </div>
    `;
    cartTotal.textContent = "₹0";
    return;
  }

  cartItems.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <div class="cart-icon">${item.icon}</div>

      <div class="cart-name">
        <h3>${item.name}</h3>
        <p>₹${item.price} each</p>
      </div>

      <div class="quantity">
        <button data-action="minus" data-index="${index}">−</button>
        <span>${item.quantity}</span>
        <button data-action="plus" data-index="${index}">+</button>
      </div>

      <button class="remove-item" data-action="remove" data-index="${index}">×</button>
    </div>
  `).join("");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartTotal.textContent = `₹${total}`;
}

function addToCart(name, price, icon) {
  const existingItem = cart.find((item) => item.name === name);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ name, price: Number(price), icon, quantity: 1 });
  }

  saveCart();
  renderCart();
  showToast(`${name} added to your order`);
}

async function loadMenu() {
  try {
    const response = await fetch("/api/menu");
    const data = await response.json();

    if (!data.success || !Array.isArray(data.items) || data.items.length === 0) {
      menuGrid.innerHTML = `<p class="menu-loading">No items on the menu right now.</p>`;
      return;
    }

    renderMenu(data.items);
  } catch {
    menuGrid.innerHTML = `<p class="menu-loading">Could not load the menu. Please refresh the page.</p>`;
  }
}

function renderMenu(items) {
  menuGrid.innerHTML = items.map((item) => `
    <article class="drink-card" data-category="${item.category}">
      <div class="drink-top">
        <span>${item.label}</span>
        <button
          class="quick-add"
          data-name="${item.name}"
          data-price="${item.price}"
          data-icon="${item.icon}"
          aria-label="Add ${item.name} to your order"
        >+</button>
      </div>

      <div class="drink-photo">
        <img src="${item.imageUrl}" alt="${item.name}" loading="lazy" />
        <div class="photo-shine"></div>
      </div>

      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <strong>₹${item.price}</strong>
    </article>
  `).join("");

  document.querySelectorAll(".quick-add").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.name, button.dataset.price, button.dataset.icon);
    });
  });
}

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const index = Number(button.dataset.index);
  const action = button.dataset.action;

  if (action === "plus") cart[index].quantity += 1;

  if (action === "minus") {
    cart[index].quantity -= 1;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
  }

  if (action === "remove") cart.splice(index, 1);

  saveCart();
  renderCart();
});

document.getElementById("openCartBtn").addEventListener("click", openCart);
document.getElementById("visitOrderBtn").addEventListener("click", openCart);
document.getElementById("closeCartBtn").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

document.getElementById("checkoutBtn").addEventListener("click", () => {
  if (!cart.length) {
    showToast("Please add a drink first.");
    return;
  }

  if (window.pageTransition) {
    window.pageTransition.goTo("payment.html");
  } else {
    window.location.href = "payment.html";
  }
});

document.querySelectorAll(".filter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".filter-btn.active").classList.remove("active");
    button.classList.add("active");

    const filter = button.dataset.filter;

    document.querySelectorAll(".drink-card").forEach((card) => {
      const shouldShow = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("hidden", !shouldShow);
    });
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("show");
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

document.addEventListener("mousemove", (event) => {
  const glow = document.querySelector(".cursor-glow");
  glow.style.transform = `translate(${event.clientX - 180}px, ${event.clientY - 180}px)`;
});

document.getElementById("playStoryBtn").addEventListener("click", () => {
  document.getElementById("story").scrollIntoView({ behavior: "smooth" });
});

renderCart();
loadMenu();