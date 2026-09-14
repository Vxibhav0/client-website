const cart = JSON.parse(localStorage.getItem("hotNColdCart")) || [];
const orderSummary = document.getElementById("orderSummary");
const payAmount = document.getElementById("payAmount");
const paymentForm = document.getElementById("paymentForm");
const successToast = document.getElementById("paymentSuccessToast");

let selectedMethod = "pay-at-cafe";

function renderSummary() {
  if (!cart.length) {
    orderSummary.innerHTML = `
      <div class="summary-item">
        <div class="summary-icon">☕</div>

        <div class="summary-info">
          <strong>No items added yet</strong>
          <span>Please go back and select a drink.</span>
        </div>
      </div>

      <div class="summary-total">
        <span>Total</span>
        <strong>₹0</strong>
      </div>
    `;

    payAmount.textContent = "₹0";
    return;
  }

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  orderSummary.innerHTML = `
    ${cart.map((item) => `
      <div class="summary-item">
        <div class="summary-icon">${item.icon}</div>

        <div class="summary-info">
          <strong>${item.name}</strong>
          <span>${item.quantity} × ₹${item.price}</span>
        </div>

        <span class="summary-price">
          ₹${item.price * item.quantity}
        </span>
      </div>
    `).join("")}

    <div class="summary-total">
      <span>Total amount</span>
      <strong>₹${total}</strong>
    </div>
  `;

  payAmount.textContent = `₹${total}`;
}

function showSuccessToast(orderId) {
  if (!successToast) return;

  const title = successToast.querySelector("strong");
  const text = successToast.querySelector("p");

  title.textContent = "Order placed successfully!";
  text.textContent = `Order ID: ${orderId}. Payment can be collected at the café.`;

  successToast.classList.add("show");

  setTimeout(() => {
    successToast.classList.remove("show");
  }, 6000);
}

document.querySelectorAll(".payment-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    selectedMethod = tab.dataset.method;

    document
      .querySelector(".payment-tab.active")
      ?.classList.remove("active");

    tab.classList.add("active");

    document.querySelectorAll(".payment-method").forEach((method) => {
      method.classList.remove("active");
    });

    document
      .getElementById(`${selectedMethod}Method`)
      ?.classList.add("active");
  });
});

document.querySelectorAll(".upi-app").forEach((app) => {
  app.addEventListener("click", () => {
    document
      .querySelector(".upi-app.selected")
      ?.classList.remove("selected");

    app.classList.add("selected");
  });
});

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!cart.length) {
    window.location.href = "index.html#menu";
    return;
  }

  const payButton = paymentForm.querySelector(".pay-btn");
  const originalButtonText = payButton.innerHTML;

  payButton.disabled = true;
  payButton.innerHTML = "Placing order...";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        items: cart,
        paymentMethod: selectedMethod
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Could not place the order."
      );
    }

    localStorage.removeItem("hotNColdCart");

    showSuccessToast(result.order.id);

    payButton.innerHTML = "Order confirmed ✓";

    setTimeout(() => {
      window.location.href = "index.html";
    }, 4000);
  } catch (error) {
    alert(error.message);

    payButton.disabled = false;
    payButton.innerHTML = originalButtonText;
  }
});

document
  .getElementById("closeSuccessToast")
  ?.addEventListener("click", () => {
    successToast.classList.remove("show");
  });

renderSummary();
