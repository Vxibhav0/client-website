const express = require("express");
const path = require("path");
const crypto = require("crypto");
const db = require("./database");
const { notifyCustomer, notifyOwner, orderConfirmedMessage, orderReadyMessage } = require("./notifications");

const app = express();
const PORT = process.env.PORT || 3000;

// Change this before you go live! Set it via: set ADMIN_PASSWORD=yourpassword (Windows)
// or export ADMIN_PASSWORD=yourpassword (Mac/Linux) before starting the server.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "hotncold@owner";
if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "⚠  ADMIN_PASSWORD not set — using default password. Set ADMIN_PASSWORD before deploying live."
  );
}

const ORDER_STATUSES = ["confirmed", "preparing", "ready", "completed", "cancelled"];
const MENU_CATEGORIES = ["coffee", "cold", "pastry", "cake"];

app.use(express.json({ limit: "20kb" }));

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

/* ---------- tiny helpers ---------- */

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;

  header.split(";").forEach((pair) => {
    const index = pair.indexOf("=");
    if (index === -1) return;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

/* ---------- admin sessions (in-memory) ---------- */

const SESSION_COOKIE = "hnc_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const sessions = new Map();

function createSession() {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  const expiry = sessions.get(token);
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];

  if (!isValidSession(token)) {
    return res.status(401).json({ success: false, message: "Please log in to view this." });
  }

  next();
}

/* ---------- admin auth routes ---------- */

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};

  const providedBuffer = Buffer.from(String(password || ""));
  const expectedBuffer = Buffer.from(ADMIN_PASSWORD);

  const isMatch =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Wrong password." });
  }

  const token = createSession();

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Strict`
  );

  res.json({ success: true });
});

app.post("/api/admin/logout", (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);

  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`);
  res.json({ success: true });
});

app.get("/api/admin/session", (req, res) => {
  const cookies = parseCookies(req);
  const authenticated = isValidSession(cookies[SESSION_COOKIE]);
  res.json({ success: true, authenticated });
});

/* ---------- Menu: public ---------- */

app.get("/api/menu", (req, res) => {
  res.json({ success: true, items: db.getPublicMenu() });
});

/* ---------- Menu: owner-only management ---------- */

function validateMenuInput(body) {
  const name = String(body.name || "").trim().slice(0, 60);
  const price = Number(body.price);
  const icon = String(body.icon || "☕").trim().slice(0, 4) || "☕";
  const category = MENU_CATEGORIES.includes(body.category) ? body.category : null;
  const description = String(body.description || "").trim().slice(0, 200);
  const imageUrl = String(body.imageUrl || "").trim().slice(0, 500);

  if (name.length < 2) return { error: "Please enter an item name." };
  if (!Number.isFinite(price) || price <= 0 || price > 100000) return { error: "Please enter a valid price." };
  if (!category) return { error: "Please choose a valid category." };

  return { value: { name, price: Math.round(price), icon, category, description, imageUrl } };
}

app.get("/api/admin/menu", requireAdmin, (req, res) => {
  res.json({ success: true, items: db.getAllMenu() });
});

app.post("/api/admin/menu", requireAdmin, (req, res) => {
  const { error, value } = validateMenuInput(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error });

  if (db.getMenuItemByName(value.name)) {
    return res.status(409).json({ success: false, message: "An item with this name already exists." });
  }

  const item = db.createMenuItem(value);
  res.status(201).json({ success: true, item });
});

app.put("/api/admin/menu/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.getMenuItemById(id);
  if (!existing) return res.status(404).json({ success: false, message: "Item not found." });

  const { error, value } = validateMenuInput(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error });

  const duplicate = db.getMenuItemByName(value.name);
  if (duplicate && duplicate.id !== id) {
    return res.status(409).json({ success: false, message: "Another item already uses this name." });
  }

  const item = db.updateMenuItem(id, value);
  res.json({ success: true, item });
});

app.patch("/api/admin/menu/:id/active", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!db.getMenuItemById(id)) return res.status(404).json({ success: false, message: "Item not found." });

  const item = db.setMenuItemActive(id, Boolean(req.body?.active));
  res.json({ success: true, item });
});

app.delete("/api/admin/menu/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const deleted = db.deleteMenuItem(id);
  if (!deleted) return res.status(404).json({ success: false, message: "Item not found." });
  res.json({ success: true });
});

/* ---------- Orders: create ---------- */

app.post("/api/orders", (req, res) => {
  try {
    const {
      items,
      paymentMethod = "pay-at-cafe",
      customer = {},
      fulfilment = "pickup",
      note = ""
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    const name = String(customer.name || "").trim().slice(0, 60);
    const phone = String(customer.phone || "").trim().slice(0, 18);
    const phoneDigits = phone.replace(/\D/g, "");

    if (name.length < 2) {
      return res.status(400).json({ success: false, message: "Please enter your name." });
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return res.status(400).json({ success: false, message: "Please enter a valid phone number." });
    }

    const fulfilmentValue = fulfilment === "dine-in" ? "dine-in" : "pickup";
    const noteValue = String(note || "").trim().slice(0, 240);

    const confirmedItems = [];

    for (const item of items) {
      const product = db.getMenuItemByName(item.name);
      const quantity = Number(item.quantity);

      if (
        !product ||
        !product.active ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 10
      ) {
        return res.status(400).json({ success: false, message: "Invalid order item." });
      }

      confirmedItems.push({
        name: product.name,
        icon: product.icon,
        price: product.price,
        quantity,
        subtotal: product.price * quantity
      });
    }

    const total = confirmedItems.reduce((sum, item) => sum + item.subtotal, 0);

    const order = db.createOrder({
      id: `HNC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      status: "confirmed",
      paymentStatus: "pending",
      paymentMethod,
      customer: { name, phone },
      fulfilment: fulfilmentValue,
      note: noteValue,
      items: confirmedItems,
      total,
      currency: "INR"
    });

    notifyCustomer(order, orderConfirmedMessage(order)).catch(() => {});
    notifyOwner(order).catch(() => {});

    res.status(201).json({ success: true, message: "Order created successfully.", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not place order. Please try again." });
  }
});

/* Check one order (kept public — for a "track my order" type lookup by exact ID) */

app.get("/api/orders/:id", (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found." });
  res.json({ success: true, order });
});

/* Owner-only: full order list */

app.get("/api/orders", requireAdmin, (req, res) => {
  res.json({ success: true, orders: db.getOrders() });
});

/* Owner-only: update order status */

app.patch("/api/orders/:id/status", requireAdmin, (req, res) => {
  const { status } = req.body || {};

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }

  const order = db.updateOrderStatus(req.params.id, status);
  if (!order) return res.status(404).json({ success: false, message: "Order not found." });

  if (status === "ready") {
    notifyCustomer(order, orderReadyMessage(order)).catch(() => {});
  }

  res.json({ success: true, order });
});

/* Any /api/* route that didn't match above — send JSON, not an HTML error page */

app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "That API route doesn't exist." });
});

/* Never let the static handler below serve the server's own source/config
   files — express.static(__dirname) otherwise makes server.js, database.js,
   notifications.js and package.json downloadable by anyone, which would leak
   the default admin password if ADMIN_PASSWORD was never set. */
const BLOCKED_STATIC_ENTRIES = new Set([
  "server.js",
  "database.js",
  "notifications.js",
  "package.json",
  "package-lock.json",
  "node_modules"
]);

app.use((req, res, next) => {
  const firstSegment = req.path.split("/").filter(Boolean)[0];
  if (firstSegment && BLOCKED_STATIC_ENTRIES.has(firstSegment)) {
    return res.status(404).send("Not found");
  }
  next();
});

/* Serve frontend files */

app.use(express.static(__dirname, { dotfiles: "deny" }));

app.listen(PORT, () => {
  console.log(`HOT n COLD running on http://localhost:${PORT}`);
});
