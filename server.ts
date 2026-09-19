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

  const isRealOrder = (o: any) => {
    if (!o || !o.id) return false;
    if (typeof o.id === "string") {
      if (o.id.startsWith("W_")) return false;
      if (/^\d{8}_\d+$/.test(o.id)) return false;
      if (/^\d{4}-\d{2}-\d{2}_/.test(o.id)) return false;
    }
    return true;
  };

  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let currentField = "";
    let inQuotes = false;
    const cleanText = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];
      if (inQuotes) {
        if (char === "\"") {
          if (nextChar === "\"") {
            currentField += "\"";
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === "\"") {
          inQuotes = true;
        } else if (char === ",") {
          row.push(currentField.trim());
          currentField = "";
        } else if (char === "\n" || char === "\r") {
          row.push(currentField.trim());
          if (row.length > 0) result.push(row);
          row = [];
          currentField = "";
          if (char === "\r" && nextChar === "\n") i++;
        } else {
          currentField += char;
        }
      }
    }
    if (currentField !== "" || row.length > 0) {
      row.push(currentField.trim());
      if (row.some(cell => cell.length > 0)) result.push(row);
    }
    return result;
  };

  const parseNum = (val: any): number => {
    if (!val) return 0;
    const cleaned = val.toString().replace(/[$,\s]/g, "");
    const p = parseFloat(cleaned);
    return isNaN(p) ? 0 : p;
  };

  const parseTradeSheetOrders = (csvText: string, defaultSales: string): any[] => {
    const rows = parseCSV(csvText);
    if (rows.length < 2) return [];
    const headerRow = rows[0].map(h => (h || "").toLowerCase().trim());
    let idCol = 12;
    let customerCol = 7;
    let userCol = 10;
    let dateCol = 0;
    let remarkCol = 13;
    let subtotalCol = 9;
    let qtyCol = 3;
    let unitCol = 4;
    let refCol = 5;
    let priceCol = 6;
    let itemCol = 1;

    headerRow.forEach((h, i) => {
      if (i > 2 && (h === "id" || h.includes("order"))) idCol = i;
      if (h.includes("customer") || h.includes("客戶")) customerCol = i;
      if (h === "user" || h.includes("sales") || h.includes("用戶")) userCol = i;
      if (h.includes("date") || h.includes("日期")) dateCol = i;
      if (h.includes("remark") || h.includes("備註")) remarkCol = i;
      if (h.includes("subtotal") || h.includes("小計")) subtotalCol = i;
      if (h.includes("quantity") || h === "qty" || h.includes("數量")) qtyCol = i;
      if (h === "unit" || h.includes("單位")) unitCol = i;
      if (h === "ref") refCol = i;
      if (h === "price" || h.includes("單價")) priceCol = i;
      if (h === "item" || h.includes("貨品")) itemCol = i;
    });

    const orderMap = new Map<string, any>();
    for (let rIdx = 1; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      if (!row || row.length === 0) continue;
      const orderId = (row[idCol] || row[12] || "").trim();
      const customer = (row[customerCol] || row[7] || "").trim();
      if (!orderId && !customer) continue;

      const finalId = orderId || `TRADE-${rIdx}`;
      const sales = (row[userCol] || row[10] || defaultSales || "").trim();
      const date = (row[dateCol] || row[0] || "").trim();
      const remark = (row[remarkCol] || row[13] || "").trim();
      const rawQty = parseNum(row[qtyCol] || row[3]);
      const unit = (row[unitCol] || row[4] || "unit").trim();
      const ref = parseNum(row[refCol] || row[5]) || 1;
      const price = parseNum(row[priceCol] || row[6]);
      const subtotal = parseNum(row[subtotalCol] || row[9]) || (rawQty * price);
      const isOuterBox = unit.toLowerCase() === "box" || unit.includes("箱") || unit.includes("盒") || unit.includes("條");
      const totalUnits = isOuterBox && ref > 1 ? (rawQty * ref) : (rawQty || (price > 0 ? Math.round(subtotal / price) : 1));
      const itemName = (row[itemCol] || row[1] || "Item").trim();

      const orderItem = {
        id: `${finalId}-item-${rIdx}`,
        name: itemName,
        quantity: totalUnits,
        price,
        isOuterBox,
        unitsPerBox: ref,
        outerBoxUnit: unit
      };

      if (!orderMap.has(finalId)) {
        orderMap.set(finalId, {
          id: finalId,
          customerName: customer,
          salesName: sales,
          date,
          remark: remark === "." ? "" : remark,
          items: [orderItem],
          orderAmount: subtotal,
          isKeyedIn: true,
          isHeld: false
        });
      } else {
        const existing = orderMap.get(finalId);
        existing.items.push(orderItem);
        existing.orderAmount += subtotal;
        if (!existing.remark && remark && remark !== ".") {
          existing.remark = remark;
        }
      }
    }
    return Array.from(orderMap.values());
  };

  const PRODUCT_LIST_SHEET_ID = "16yXbnBdkKuKCVGvhrUJ7YPFNVGBcyap3b5sbvqv0Dsg";
  const GVIZ_TRADE_URL = `https://docs.google.com/spreadsheets/d/${PRODUCT_LIST_SHEET_ID}/gviz/tq?tqx=out:csv&gid=1412322886`;
  const GVIZ_ADMIN_URL = `https://docs.google.com/spreadsheets/d/${PRODUCT_LIST_SHEET_ID}/gviz/tq?tqx=out:csv&gid=2071438386`;
  const PUB_TRADE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vStdyv4mUaIdO-jPeUwBfxMxBZbCkbNEtk8VNhyrpiAInlNb7w3jli2jYtERyVPp94aWMeVuP4N0XNv/pub?gid=1412322886&single=true&output=csv";
  const PUB_ADMIN_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vStdyv4mUaIdO-jPeUwBfxMxBZbCkbNEtk8VNhyrpiAInlNb7w3jli2jYtERyVPp94aWMeVuP4N0XNv/pub?gid=2071438386&single=true&output=csv";

  let cachedTradeOrders: any[] = [];
  let lastTradeFetchTime = 0;

  const fetchTradeLogOrdersFromServer = async (): Promise<any[]> => {
    const now = Date.now();
    if (cachedTradeOrders.length > 0 && (now - lastTradeFetchTime) < 15000) {
      return cachedTradeOrders;
    }

    const fetchSheetCSV = async (gvizUrl: string, pubUrl: string): Promise<string> => {
      try {
        const res = await fetch(gvizUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const text = await res.text();
          if (text.length > 50) return text;
        }
      } catch {}
      try {
        const res2 = await fetch(`${pubUrl}&t=${Date.now()}`, { signal: AbortSignal.timeout(5000) });
        if (res2.ok) return await res2.text();
      } catch {}
      return "";
    };

    try {
      const [tradeCsv, adminCsv] = await Promise.all([
        fetchSheetCSV(GVIZ_TRADE_URL, PUB_TRADE_URL),
        fetchSheetCSV(GVIZ_ADMIN_URL, PUB_ADMIN_URL)
      ]);

      const tradeOrders = tradeCsv ? parseTradeSheetOrders(tradeCsv, "Sales") : [];
      const adminOrders = adminCsv ? parseTradeSheetOrders(adminCsv, "Admin") : [];
      const all = [...tradeOrders, ...adminOrders];
      if (all.length > 0) {
        cachedTradeOrders = all;
        lastTradeFetchTime = now;
        return all;
      }
    } catch (err) {
      console.warn("Failed to fetch trade log orders from Google Sheets:", err);
    }
    return cachedTradeOrders;
  };

  const getSavedOrders = (): any[] => {
    try {
      if (fs.existsSync(ORDERS_FILE)) {
        const raw = fs.readFileSync(ORDERS_FILE, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          return list.filter(isRealOrder);
        }
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

  // Get orders directly from Trade_log and Trade_log_admin tabs of Product_list
  app.get("/api/trade-orders", async (req, res) => {
    try {
      const orders = await fetchTradeLogOrdersFromServer();
      res.json({ success: true, orders });
    } catch (err) {
      console.error("Error fetching trade orders:", err);
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  // Get all shared saved/pending orders across devices
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = getSavedOrders();
      res.json({ success: true, orders });
    } catch (err) {
      res.json({ success: true, orders: [] });
    }
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
    currentOrders.filter(isRealOrder).forEach((o: any) => {
      if (o && o.id) orderMap.set(o.id, o);
    });

    // Merge incoming (ignoring any historical Log invoices)
    incoming.filter(isRealOrder).forEach((o: any) => {
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
