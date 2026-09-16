function getCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem("hotNColdCart"));
    return Array.isArray(savedCart) ? savedCart : [];
  } catch {
    return [];
  }
}

const cart = getCart();
const orderSummary = document.getElementById("orderSummary");
const payAmount = document.getElementById("payAmount");
const paymentForm = document.getElementById("paymentForm");
const successToast = document.getElementById("paymentSuccessToast");
const formMessage = document.getElementById("formMessage");

function formatPrice(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function renderSummary() {
  if (!cart.length) {
    orderSummary.innerHTML = `
      <div class="summary-item">
        <div class="summary-icon">☕</div>
        <div class="summary-info">
          <strong>Your cart is empty</strong>
          <span>Please choose something from the menu.</span>
        </div>
      </div>
      <div class="summary-total"><span>Total</span><strong>₹0</strong></div>
    `;
    payAmount.textContent = "₹0";
    return;
  }

  const total = cart.reduce((sum, item) => {
    return sum + Number(item.price) * Number(item.quantity);
  }, 0);

  orderSummary.innerHTML = `
    ${cart.map((item) => `
      <div class="summary-item">
        <div class="summary-icon">${item.icon}</div>
        <div class="summary-info">
          <strong>${item.name}</strong>
          <span>${item.quantity} × ${formatPrice(item.price)}</span>
        </div>
        <span class="summary-price">${formatPrice(item.price * item.quantity)}</span>
      </div>
    `).join("")}
    <div class="summary-total">
      <span>Total amount</span>
      <strong>${formatPrice(total)}</strong>
    </div>
  `;

  payAmount.textContent = formatPrice(total);
}

function showMessage(message) {
  formMessage.textContent = message;
}

function showSuccessToast(order) {
  const title = successToast.querySelector("strong");
  const text = successToast.querySelector("p");
  const collection = order.fulfilment === "dine-in" ? "Dine in" : "Pick up";

  title.textContent = "Order confirmed!";
  text.textContent = `${collection} order ${order.id} is now with the barista.`;
  successToast.classList.add("show");
}

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");

  if (!cart.length) {
    showMessage("Your cart is empty. Please add something from the menu first.");
    return;
  }

  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const note = document.getElementById("orderNote").value.trim();
  const fulfilment = document.querySelector('input[name="fulfilment"]:checked').value;
  const phoneDigits = phone.replace(/\D/g, "");

  if (name.length < 2) {
    showMessage("Please enter your name.");
    return;
  }

  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    showMessage("Please enter a valid phone number.");
    return;
  }

  const submitButton = paymentForm.querySelector(".pay-btn");
  const originalLabel = submitButton.innerHTML;

  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  submitButton.innerHTML = "Placing order…";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart,
        customer: { name, phone },
        fulfilment,
        note
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Could not place the order. Please try again.");
    }

    localStorage.removeItem("hotNColdCart");
    showSuccessToast(result.order);
    submitButton.innerHTML = "Order confirmed ✓";
    paymentForm.reset();
  } catch (error) {
    showMessage(error.message);
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
    submitButton.innerHTML = originalLabel;
  }
});

document.getElementById("closeSuccessToast").addEventListener("click", () => {
  successToast.classList.remove("show");
  window.location.href = "index.html";
});

renderSummary();
