const lockScreen = document.getElementById("lockScreen");
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("passwordInput");
const lockMessage = document.getElementById("lockMessage");

const desk = document.getElementById("desk");
const orderList = document.getElementById("orderList");
const emptyState = document.getElementById("emptyState");
const statusTabs = document.getElementById("statusTabs");
const orderCardTemplate = document.getElementById("orderCardTemplate");

const statOrders = document.getElementById("statOrders");
const statRevenue = document.getElementById("statRevenue");
const statPending = document.getElementById("statPending");

const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");

const viewTabs = document.getElementById("viewTabs");
const ordersView = document.getElementById("ordersView");
const menuView = document.getElementById("menuView");

const addMenuItemBtn = document.getElementById("addMenuItemBtn");
const menuItemsList = document.getElementById("menuItemsList");
const menuEmptyState = document.getElementById("menuEmptyState");
const menuItemRowTemplate = document.getElementById("menuItemRowTemplate");

const menuModalOverlay = document.getElementById("menuModalOverlay");
const menuForm = document.getElementById("menuForm");
const menuModalTitle = document.getElementById("menuModalTitle");
const menuModalCancel = document.getElementById("menuModalCancel");
const menuFormMessage = document.getElementById("menuFormMessage");
const menuNameInput = document.getElementById("menuName");
const menuPriceInput = document.getElementById("menuPrice");
const menuIconInput = document.getElementById("menuIcon");
const menuCategoryInput = document.getElementById("menuCategory");
const menuDescriptionInput = document.getElementById("menuDescription");
const menuImageUrlInput = document.getElementById("menuImageUrl");

let allMenuItems = [];
let editingMenuItemId = null;

let allOrders = [];
let activeStatus = "all";
let refreshTimer = null;

// If the server sends back HTML instead of JSON (old server.js still running,
// wrong route, server crashed, etc.) this stops a cryptic parse crash and
// gives a message that actually points at the fix.
async function safeJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Server didn't send back the expected data. Make sure the updated server.js is saved in the project folder and the server has been restarted."
    );
  }
}

const STATUS_LABEL = {
  confirmed: "New",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled"
};

function formatPrice(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

const IST_TIME_ZONE = "Asia/Kolkata";

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function istDateKey(isoString) {
  // en-CA gives YYYY-MM-DD, handy for a same-day comparison in a fixed time zone.
  return new Date(isoString).toLocaleDateString("en-CA", { timeZone: IST_TIME_ZONE });
}

function isToday(isoString) {
  return istDateKey(isoString) === istDateKey(new Date().toISOString());
}

/* ---------- View switching ---------- */

function showLockScreen(message = "") {
  lockScreen.hidden = false;
  desk.hidden = true;
  lockMessage.textContent = message;
  stopAutoRefresh();
}

function showDesk() {
  lockScreen.hidden = true;
  desk.hidden = false;
  loadOrders();
  startAutoRefresh();
}

/* ---------- Session / auth ---------- */

async function checkSession() {
  try {
    const response = await fetch("/api/admin/session");
    const data = await safeJson(response);

    if (data.authenticated) {
      showDesk();
    } else {
      showLockScreen();
    }
  } catch (error) {
    showLockScreen(error.message || "Could not reach the server. Please refresh.");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  lockMessage.textContent = "";

  const submitButton = loginForm.querySelector(".unlock-btn");
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput.value })
    });

    const data = await safeJson(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Wrong password.");
    }

    passwordInput.value = "";
    showDesk();
  } catch (error) {
    lockMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  allOrders = [];
  showLockScreen();
});

/* ---------- Orders ---------- */

async function loadOrders() {
  try {
    const response = await fetch("/api/orders");

    if (response.status === 401) {
      showLockScreen("Your session ended. Please sign in again.");
      return;
    }

    const data = await safeJson(response);
    if (!data.success) return;

    allOrders = data.orders;
    renderStats();
    renderOrders();
  } catch {
    // Silent fail on a background refresh — keep showing the last known list.
  }
}

function renderStats() {
  const todaysOrders = allOrders.filter((order) => isToday(order.createdAt));
  const revenue = todaysOrders.reduce((sum, order) => sum + order.total, 0);
  const pending = allOrders.filter(
    (order) => order.status === "confirmed" || order.status === "preparing"
  ).length;

  statOrders.textContent = todaysOrders.length;
  statRevenue.textContent = formatPrice(revenue);
  statPending.textContent = pending;
}

function renderOrders() {
  const filtered =
    activeStatus === "all"
      ? allOrders
      : allOrders.filter((order) => order.status === activeStatus);

  orderList.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((order) => {
    const card = orderCardTemplate.content.cloneNode(true);
    const article = card.querySelector(".order-card");

    article.dataset.status = order.status;
    article.querySelector(".order-id").textContent = order.id;
    article.querySelector(".order-time").textContent = formatTime(order.createdAt);

    const badge = article.querySelector(".fulfilment-badge");
    badge.textContent = order.fulfilment === "dine-in" ? "Dine in" : "Pick up";

    article.querySelector(".customer-name").textContent =
      order.customer?.name || "Guest";

    const phoneLink = article.querySelector(".customer-phone");
    const phone = order.customer?.phone || "";
    phoneLink.textContent = phone;
    phoneLink.href = phone ? `tel:${phone}` : "#";

    const itemsList = article.querySelector(".order-items");
    order.items.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${item.icon} ${item.quantity} × ${item.name}</span><span>${formatPrice(item.subtotal)}</span>`;
      itemsList.appendChild(li);
    });

    const noteEl = article.querySelector(".order-note");
    if (order.note) {
      noteEl.hidden = false;
      noteEl.textContent = order.note;
    }

    article.querySelector(".order-total").textContent = formatPrice(order.total);

    const select = article.querySelector(".status-select");
    select.value = order.status;
    select.addEventListener("change", () => updateStatus(order.id, select.value, article));

    orderList.appendChild(card);
  });
}

async function updateStatus(orderId, status, cardElement) {
  try {
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    const data = await safeJson(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not update the order.");
    }

    cardElement.dataset.status = status;

    const order = allOrders.find((item) => item.id === orderId);
    if (order) order.status = status;

    renderStats();
    if (activeStatus !== "all" && activeStatus !== status) {
      renderOrders();
    }
  } catch {
    loadOrders();
  }
}

/* ---------- View tabs (Orders / Menu) ---------- */

viewTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".view-tab");
  if (!button) return;

  viewTabs.querySelector(".view-tab.active").classList.remove("active");
  button.classList.add("active");

  const view = button.dataset.view;
  ordersView.hidden = view !== "orders";
  menuView.hidden = view !== "menu";

  if (view === "menu") loadMenuItems();
});

/* ---------- Menu management ---------- */

async function loadMenuItems() {
  try {
    const response = await fetch("/api/admin/menu");

    if (response.status === 401) {
      showLockScreen("Your session ended. Please sign in again.");
      return;
    }

    const data = await safeJson(response);
    if (!data.success) return;

    allMenuItems = data.items;
    renderMenuItems();
  } catch (error) {
    menuItemsList.innerHTML = "";
    menuEmptyState.hidden = false;
    menuEmptyState.textContent = error.message || "Could not load the menu.";
  }
}

function renderMenuItems() {
  menuItemsList.innerHTML = "";
  menuEmptyState.hidden = allMenuItems.length > 0;
  menuEmptyState.textContent = "No menu items yet — add your first one.";

  allMenuItems.forEach((item) => {
    const row = menuItemRowTemplate.content.cloneNode(true);
    const rowEl = row.querySelector(".menu-item-row");

    rowEl.classList.toggle("inactive", !item.active);
    rowEl.querySelector(".menu-item-icon").textContent = item.icon;
    rowEl.querySelector(".menu-item-name").textContent = item.name;
    rowEl.querySelector(".menu-item-meta").textContent =
      `${item.category} · ${formatPrice(item.price)}`;

    const toggle = rowEl.querySelector(".active-toggle");
    toggle.checked = item.active;
    toggle.addEventListener("change", () => setItemActive(item.id, toggle.checked, rowEl));

    rowEl.querySelector(".edit-btn").addEventListener("click", () => openMenuModal(item));
    rowEl.querySelector(".delete-btn").addEventListener("click", () => deleteMenuItem(item));

    menuItemsList.appendChild(row);
  });
}

async function setItemActive(id, active, rowEl) {
  try {
    const response = await fetch(`/api/admin/menu/${id}/active`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active })
    });

    const data = await safeJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "Could not update the item.");

    rowEl.classList.toggle("inactive", !active);
    const item = allMenuItems.find((menuItem) => menuItem.id === id);
    if (item) item.active = active;
  } catch (error) {
    alert(error.message);
    loadMenuItems();
  }
}

async function deleteMenuItem(item) {
  const confirmed = confirm(`Delete "${item.name}" from the menu? This can't be undone.`);
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/admin/menu/${item.id}`, { method: "DELETE" });
    const data = await safeJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "Could not delete the item.");

    allMenuItems = allMenuItems.filter((menuItem) => menuItem.id !== item.id);
    renderMenuItems();
  } catch (error) {
    alert(error.message);
  }
}

function openMenuModal(item = null) {
  editingMenuItemId = item ? item.id : null;
  menuModalTitle.textContent = item ? "Edit item" : "Add item";
  menuFormMessage.textContent = "";

  menuNameInput.value = item?.name || "";
  menuPriceInput.value = item?.price || "";
  menuIconInput.value = item?.icon || "";
  menuCategoryInput.value = item?.category || "coffee";
  menuDescriptionInput.value = item?.description || "";
  menuImageUrlInput.value = item?.imageUrl || "";

  menuModalOverlay.hidden = false;
  menuNameInput.focus();
}

function closeMenuModal() {
  menuModalOverlay.hidden = true;
  menuForm.reset();
  editingMenuItemId = null;
}

addMenuItemBtn.addEventListener("click", () => openMenuModal());
menuModalCancel.addEventListener("click", closeMenuModal);

menuModalOverlay.addEventListener("click", (event) => {
  if (event.target === menuModalOverlay) closeMenuModal();
});

menuForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  menuFormMessage.textContent = "";

  const payload = {
    name: menuNameInput.value.trim(),
    price: Number(menuPriceInput.value),
    icon: menuIconInput.value.trim() || "☕",
    category: menuCategoryInput.value,
    description: menuDescriptionInput.value.trim(),
    imageUrl: menuImageUrlInput.value.trim()
  };

  const saveButton = document.getElementById("menuModalSave");
  saveButton.disabled = true;

  try {
    const url = editingMenuItemId ? `/api/admin/menu/${editingMenuItemId}` : "/api/admin/menu";
    const method = editingMenuItemId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await safeJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "Could not save the item.");

    closeMenuModal();
    loadMenuItems();
  } catch (error) {
    menuFormMessage.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

/* ---------- Tabs & refresh ---------- */

statusTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".status-tab");
  if (!button) return;

  statusTabs.querySelector(".status-tab.active").classList.remove("active");
  button.classList.add("active");
  activeStatus = button.dataset.status;
  renderOrders();
});

refreshBtn.addEventListener("click", loadOrders);

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(loadOrders, 20000);
}

function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

checkSession();
