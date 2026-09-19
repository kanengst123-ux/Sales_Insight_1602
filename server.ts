import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Ensure data directory exists for shared persistent orders across devices
  const DATA_DIR = path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const ORDERS_FILE = path.join(DATA_DIR, "saved_orders.json");

  const getSavedOrders = (): any[] => {
    try {
      if (fs.existsSync(ORDERS_FILE)) {
        const raw = fs.readFileSync(ORDERS_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error("Error reading saved orders file:", err);
    }
    return [];
  };

  const saveOrdersToFile = (orders: any[]) => {
    try {
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing saved orders file:", err);
    }
  };

  // API Routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get all shared saved/pending orders across devices
  app.get("/api/orders", (req, res) => {
    const orders = getSavedOrders();
    res.json({ success: true, orders });
  });

  // Save or update an order
  app.post("/api/orders", (req, res) => {
    const order = req.body;
    if (!order || !order.id) {
      res.status(400).json({ error: "Order ID is required" });
      return;
    }
    const orders = getSavedOrders();
    const idx = orders.findIndex((o: any) => o.id === order.id);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...order };
    } else {
      orders.unshift(order);
    }
    saveOrdersToFile(orders);
    res.json({ success: true, order });
  });

  // Batch sync orders (e.g. from local storage)
  app.post("/api/orders/sync", (req, res) => {
    const incoming: any[] = req.body.orders || [];
    if (!Array.isArray(incoming)) {
      res.status(400).json({ error: "orders array required" });
      return;
    }
    const currentOrders = getSavedOrders();
    const orderMap = new Map<string, any>();

    // Existing server orders
    currentOrders.forEach((o: any) => {
      if (o && o.id) orderMap.set(o.id, o);
    });

    // Merge incoming
    incoming.forEach((o: any) => {
      if (o && o.id) {
        if (!orderMap.has(o.id)) {
          orderMap.set(o.id, o);
        } else {
          const existing = orderMap.get(o.id);
          orderMap.set(o.id, { ...existing, ...o });
        }
      }
    });

    const merged = Array.from(orderMap.values());
    saveOrdersToFile(merged);
    res.json({ success: true, orders: merged });
  });

  // Delete an order
  app.delete("/api/orders/:id", (req, res) => {
    const orderId = req.params.id;
    let orders = getSavedOrders();
    orders = orders.filter((o: any) => o.id !== orderId);
    saveOrdersToFile(orders);
    res.json({ success: true });
  });

  // Toggle hold on an order
  app.patch("/api/orders/:id/hold", (req, res) => {
    const orderId = req.params.id;
    const orders = getSavedOrders();
    const order = orders.find((o: any) => o.id === orderId);
    if (order) {
      order.isHeld = !order.isHeld;
      if (order.isHeld) {
        order.isKeyedIn = false;
      }
      saveOrdersToFile(orders);
      res.json({ success: true, order });
    } else {
      res.status(404).json({ error: "Order not found" });
    }
  });

  // Mark order as keyed in
  app.patch("/api/orders/:id/keyin", (req, res) => {
    const orderId = req.params.id;
    const orders = getSavedOrders();
    const order = orders.find((o: any) => o.id === orderId);
    if (order) {
      order.isKeyedIn = true;
      saveOrdersToFile(orders);
      res.json({ success: true, order });
    } else {
      res.status(404).json({ error: "Order not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // In Express v5, use '*all' for catch-all route
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
