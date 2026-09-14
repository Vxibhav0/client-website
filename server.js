const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const dataFolder = path.join(__dirname, ".data");
const ordersFile = path.join(dataFolder, "orders.json");

const menu = {
  Cappuccino: {
    price: 180,
    icon: "☕"
  },

  "Caramel Latte": {
    price: 210,
    icon: "☕"
  },

  "Cold Coffee": {
    price: 160,
    icon: "🥤"
  },

  "Mocha Frappe": {
    price: 230,
    icon: "🥤"
  },

  "Butter Croissant": {
    price: 160,
    icon: "🥐"
  },

  "Almond Croissant": {
    price: 190,
    icon: "🥐"
  },

  "Cinnamon Roll": {
    price: 170,
    icon: "🥨"
  },

  "Chocolate Muffin": {
    price: 140,
    icon: "🧁"
  },

  "Chocolate Truffle Cake": {
    price: 220,
    icon: "🍰"
  },

  "Basque Cheesecake": {
    price: 240,
    icon: "🍮"
  }
};

app.use(express.json({ limit: "20kb" }));

async function getOrders() {
  try {
    const file = await fs.readFile(ordersFile, "utf8");
    return JSON.parse(file);
  } catch {
    return [];
  }
}

async function saveOrders(orders) {
  await fs.mkdir(dataFolder, { recursive: true });
  await fs.writeFile(
    ordersFile,
    JSON.stringify(orders, null, 2),
    "utf8"
  );
}

/* Create order */

app.post("/api/orders", async (req, res) => {
  try {
    const { items, paymentMethod = "pay-at-cafe" } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty."
      });
    }

    const confirmedItems = [];

    for (const item of items) {
      const product = menu[item.name];
      const quantity = Number(item.quantity);

      if (
        !product ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 10
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid order item."
        });
      }

      confirmedItems.push({
        name: item.name,
        icon: product.icon,
        price: product.price,
        quantity,
        subtotal: product.price * quantity
      });
    }

    const total = confirmedItems.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    const order = {
      id: `HNC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      status: "confirmed",
      paymentStatus: "pending",
      paymentMethod,
      items: confirmedItems,
      total,
      currency: "INR"
    };

    const orders = await getOrders();
    orders.unshift(order);

    await saveOrders(orders);

    res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not place order. Please try again."
    });
  }
});

/* Check one order */

app.get("/api/orders/:id", async (req, res) => {
  const orders = await getOrders();

  const order = orders.find(
    (item) => item.id === req.params.id
  );

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found."
    });
  }

  res.json({
    success: true,
    order
  });
});

/* For future admin panel */

app.get("/api/orders", async (req, res) => {
  const orders = await getOrders();

  res.json({
    success: true,
    orders
  });
});

/* Serve frontend files */

app.use(
  express.static(__dirname, {
    dotfiles: "deny"
  })
);

app.listen(PORT, () => {
  console.log(`HOT n COLD running on http://localhost:${PORT}`);
});
