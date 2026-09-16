const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, ".data");
fs.mkdirSync(dataFolder, { recursive: true });

const DB_FILE = path.join(dataFolder, "hotncold.json");

let state = { menu_items: [], orders: [] };

function load() {
  if (fs.existsSync(DB_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      if (!state.menu_items) state.menu_items = [];
      if (!state.orders) state.orders = [];
    } catch (e) {
      state = { menu_items: [], orders: [] };
    }
  }
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf8");
}

/* ---------- One-time seed: the menu that used to be hardcoded in server.js ---------- */

const CATEGORY_LABEL = {
  coffee: "HOT",
  cold: "COLD",
  pastry: "BAKERY",
  cake: "CAKES"
};

load();

if (state.menu_items.length === 0) {
  const seedItems = [
    { name: "Cappuccino", price: 180, icon: "☕", category: "coffee", description: "Double espresso, silk milk and cloud-like foam.", imageUrl: "https://images.unsplash.com/photo-1637959741616-16c7bfe9300b?auto=format&fit=crop&w=800&q=85" },
    { name: "Caramel Latte", price: 210, icon: "☕", category: "coffee", description: "Smooth espresso, warm caramel and creamy milk.", imageUrl: "https://images.unsplash.com/photo-1524671710025-d79530c2f957?auto=format&fit=crop&w=800&q=85" },
    { name: "Cold Coffee", price: 160, icon: "🥤", category: "cold", description: "Chilled coffee, vanilla cream and a perfectly soft finish.", imageUrl: "https://images.unsplash.com/photo-1686575669781-74e03080541b?auto=format&fit=crop&w=800&q=85" },
    { name: "Mocha Frappe", price: 230, icon: "🥤", category: "cold", description: "Espresso, dark chocolate, ice and pure happiness.", imageUrl: "https://images.unsplash.com/photo-1645243370660-b5ae21c7d02d?auto=format&fit=crop&w=800&q=85" },
    { name: "Butter Croissant", price: 160, icon: "🥐", category: "pastry", description: "Golden, shatteringly crisp and made for a long coffee break.", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85" },
    { name: "Almond Croissant", price: 190, icon: "🥐", category: "pastry", description: "Buttery layers, almond cream and a little extra crunch.", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85&crop=entropy" },
    { name: "Cinnamon Roll", price: 170, icon: "🥨", category: "pastry", description: "Warm spice, soft swirls and vanilla glaze on top.", imageUrl: "https://images.unsplash.com/photo-1514509152927-0403a1b6a2d8?auto=format&fit=crop&w=900&q=85" },
    { name: "Chocolate Muffin", price: 140, icon: "🧁", category: "pastry", description: "Moist cocoa crumb, molten centre, no sharing required.", imageUrl: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=900&q=85" },
    { name: "Chocolate Truffle Cake", price: 220, icon: "🍰", category: "cake", description: "Dark chocolate layers, glossy ganache and soft sponge.", imageUrl: "https://images.unsplash.com/photo-1707718189563-17eb5ab9a82b?auto=format&fit=crop&w=900&q=85" },
    { name: "Basque Cheesecake", price: 240, icon: "🍮", category: "cake", description: "Burnt top, silky centre and the dreamiest caramel finish.", imageUrl: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85" }
  ];

  const now = new Date().toISOString();
  seedItems.forEach((item, index) => {
    state.menu_items.push({
      id: index + 1,
      name: item.name,
      price: item.price,
      icon: item.icon,
      category: item.category,
      description: item.description,
      image_url: item.imageUrl || "",
      active: 1,
      sort_order: index,
      created_at: now
    });
  });

  save();
  console.log(`Seeded menu_items with ${seedItems.length} starter items.`);
}

/* ---------- One-time migration: pull in any orders from the old orders.json ---------- */

const legacyOrdersFile = path.join(dataFolder, "orders.json");

if (state.orders.length === 0 && fs.existsSync(legacyOrdersFile)) {
  try {
    const legacyOrders = JSON.parse(fs.readFileSync(legacyOrdersFile, "utf8"));
    if (Array.isArray(legacyOrders) && legacyOrders.length > 0) {
      legacyOrders.forEach((order) => {
        state.orders.push({
          id: order.id,
          created_at: order.createdAt || new Date().toISOString(),
          status: order.status || "confirmed",
          payment_status: order.paymentStatus || "pending",
          payment_method: order.paymentMethod || "pay-at-cafe",
          customer_name: order.customer?.name || "Guest",
          customer_phone: order.customer?.phone || "",
          fulfilment: order.fulfilment || "pickup",
          note: order.note || "",
          items_json: JSON.stringify(order.items || []),
          total: order.total || 0,
          currency: order.currency || "INR"
        });
      });
      save();
      console.log(`Imported ${legacyOrders.length} order(s) from the old orders.json into the database.`);
    }
  } catch (error) {
    console.warn("Could not import old orders.json — starting with an empty orders table.", error.message);
  }
}

/* ---------- Row <-> app-shape mappers ---------- */

function rowToMenuItem(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    icon: row.icon,
    category: row.category,
    label: CATEGORY_LABEL[row.category] || row.category.toUpperCase(),
    description: row.description,
    imageUrl: row.image_url,
    active: Boolean(row.active),
    sortOrder: row.sort_order
  };
}

function rowToOrder(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    customer: { name: row.customer_name, phone: row.customer_phone },
    fulfilment: row.fulfilment,
    note: row.note,
    items: JSON.parse(row.items_json),
    total: row.total,
    currency: row.currency
  };
}

/* ---------- Menu API ---------- */

function getPublicMenu() {
  return state.menu_items
    .filter((m) => Number(m.active) === 1)
    .slice()
    .sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id))
    .map(rowToMenuItem);
}

function getAllMenu() {
  return state.menu_items
    .slice()
    .sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id))
    .map(rowToMenuItem);
}

function getMenuItemById(id) {
  const row = state.menu_items.find((m) => Number(m.id) === Number(id));
  return row ? rowToMenuItem(row) : null;
}

function getMenuItemByName(name) {
  const row = state.menu_items.find((m) => String(m.name) === String(name));
  return row ? rowToMenuItem(row) : null;
}

function createMenuItem({ name, price, icon, category, description, imageUrl }) {
  const maxOrder = state.menu_items.reduce((acc, m) => Math.max(acc, Number(m.sort_order || 0)), -1);
  const nextId = state.menu_items.reduce((acc, m) => Math.max(acc, Number(m.id || 0)), 0) + 1;

  const record = {
    id: nextId,
    name,
    price,
    icon,
    category,
    description,
    image_url: imageUrl || "",
    sort_order: maxOrder + 1,
    active: 1,
    created_at: new Date().toISOString()
  };

  state.menu_items.push(record);
  save();
  return getMenuItemById(record.id);
}

function updateMenuItem(id, { name, price, icon, category, description, imageUrl }) {
  const idx = state.menu_items.findIndex((m) => Number(m.id) === Number(id));
  if (idx === -1) return null;
  const m = state.menu_items[idx];
  m.name = name;
  m.price = price;
  m.icon = icon;
  m.category = category;
  m.description = description;
  m.image_url = imageUrl || "";
  save();
  return getMenuItemById(id);
}

function setMenuItemActive(id, active) {
  const m = state.menu_items.find((x) => Number(x.id) === Number(id));
  if (!m) return null;
  m.active = active ? 1 : 0;
  save();
  return getMenuItemById(id);
}

function deleteMenuItem(id) {
  const before = state.menu_items.length;
  state.menu_items = state.menu_items.filter((m) => Number(m.id) !== Number(id));
  const changed = state.menu_items.length !== before;
  if (changed) save();
  return changed;
}

/* ---------- Orders API ---------- */

function getOrders() {
  return state.orders
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map(rowToOrder);
}

function getOrderById(id) {
  const row = state.orders.find((o) => String(o.id) === String(id));
  return row ? rowToOrder(row) : null;
}

function createOrder(order) {
  state.orders.push({
    id: order.id,
    created_at: order.createdAt,
    status: order.status,
    payment_status: order.paymentStatus,
    payment_method: order.paymentMethod,
    customer_name: order.customer.name,
    customer_phone: order.customer.phone,
    fulfilment: order.fulfilment,
    note: order.note || "",
    items_json: JSON.stringify(order.items),
    total: order.total,
    currency: order.currency || "INR"
  });
  save();
  return getOrderById(order.id);
}

function updateOrderStatus(id, status) {
  const o = state.orders.find((x) => String(x.id) === String(id));
  if (!o) return null;
  o.status = status;
  save();
  return getOrderById(id);
}

module.exports = {
  getPublicMenu,
  getAllMenu,
  getMenuItemById,
  getMenuItemByName,
  createMenuItem,
  updateMenuItem,
  setMenuItemActive,
  deleteMenuItem,
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus
};
