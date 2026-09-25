
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchSalesData, 
  calculateAnalytics, 
  fetchCustomerGrades, 
  writeTradeLogToSheet, 
  deleteOrderFromSheet, 
  fetchProducts,
  fetchCloudTradeLogOrders,
  fetchServerOrders,
  saveServerOrder,
  syncServerOrders,
  deleteServerOrder,
  toggleHoldServerOrder,
  keyInServerOrder,
  keyInServerOrdersBatch,
  purgeDeletedOrdersFromCache
} from './services/dataService';
import { getCachedItem } from './services/cacheService';
import { SaleRecord, SalesAnalytics, SavedOrder, Customer, Product, APP_USERS, isOrderOwner } from './types';
import Dashboard from './components/Dashboard';
import PivotTable from './components/PivotTable';
import CollectionsTable from './components/CollectionsTable';
import InactiveCustomers from './components/InactiveCustomers';
import CustomerGrades from './components/CustomerGrades';
import OrderEntry from './components/OrderEntry';
import OrderList from './components/OrderList';
import { Layout, BarChart3, Database, RefreshCw, AlertCircle, Loader2, Table as TableIcon, Menu, X, FileQuestion, Globe, HardDrive, Settings2, ReceiptText, UserX, Award, Plus, ListOrdered, UserCircle } from 'lucide-react';

// Track order IDs submitted in this current session so they stay marked until next sheet sync
const recentlySubmittedOrderIds = new Set<string>();

const mergeOrderLists = (
  local: SavedOrder[],
  cloud: SavedOrder[],
  server: SavedOrder[],
  deletedIds: Set<string> = new Set(),
  recentlySubmitted: Set<string> = recentlySubmittedOrderIds
): SavedOrder[] => {
  const map = new Map<string, SavedOrder>();
  const validCloudIds = new Set<string>();

  // 1. Cloud orders come EXCLUSIVELY from 'Trade_log' & 'Trade_log_admin' tabs of 'Product_list'
  // Every order in cloud is an authentic, confirmed keyed-in order.
  for (const o of cloud) {
    if (o && o.id && !deletedIds.has(o.id)) {
      validCloudIds.add(o.id);
      map.set(o.id, { ...o, isKeyedIn: true, isHeld: false });
    }
  }

  // Helper to merge or filter candidates from server or local
  const mergeCandidate = (o: SavedOrder) => {
    if (!o || !o.id || deletedIds.has(o.id)) return;

    // Filter out obsolete raw Log invoice IDs
    if (o.id.startsWith('W_') || /^\d{8}_\d+$/.test(o.id) || /^\d{4}-\d{2}-\d{2}_/.test(o.id)) {
      return;
    }

    if (map.has(o.id)) {
      const existing = map.get(o.id)!;
      // If candidate o has a newer updatedAt timestamp, or if existing has no updatedAt:
      const candidateIsNewer = Boolean(
        o.updatedAt && (!existing.updatedAt || o.updatedAt >= existing.updatedAt)
      );

      // Preferred items: if candidate is newer or has more complete items, take candidate items
      const preferredItems = (candidateIsNewer && o.items && o.items.length > 0)
        ? o.items
        : ((o.items && o.items.length >= (existing.items?.length || 0)) ? o.items : (existing.items || []));

      const preferredAmount = candidateIsNewer && o.orderAmount !== undefined
        ? o.orderAmount
        : (existing.orderAmount !== undefined ? existing.orderAmount : o.orderAmount);

      const preferredRemark = candidateIsNewer && o.remark !== undefined
        ? o.remark
        : (o.remark || existing.remark);

      // Determine keyed in status:
      // 1. If explicitly submitted in current session: ALWAYS true!
      // 2. If candidate has isKeyedIn === false and wasn't submitted in this session: FALSE!
      // 3. If candidate is newer and specifies isKeyedIn: use candidate's isKeyedIn
      // 4. Otherwise keep existing status (from cloud or previous candidate)
      let isKeyedIn = existing.isKeyedIn;
      if (recentlySubmitted.has(o.id)) {
        isKeyedIn = true;
      } else if (o.isKeyedIn === false) {
        isKeyedIn = false;
      } else if (candidateIsNewer && o.isKeyedIn !== undefined) {
        isKeyedIn = o.isKeyedIn;
      }

      map.set(o.id, {
        ...existing,
        ...o,
        items: preferredItems,
        orderAmount: preferredAmount,
        remark: preferredRemark,
        isHeld: candidateIsNewer ? (o.isHeld ?? existing.isHeld) : (existing.isHeld ?? o.isHeld),
        isKeyedIn,
        updatedAt: Math.max(existing.updatedAt || 0, o.updatedAt || 0)
      });
      return;
    }

    // If NOT in Trade_log / Trade_log_admin yet:
    let isKeyedIn = o.isKeyedIn ?? false;
    if (recentlySubmitted.has(o.id)) {
      isKeyedIn = true;
    } else if (o.isKeyedIn === false) {
      isKeyedIn = false;
    }

    map.set(o.id, {
      ...o,
      isKeyedIn
    });
  };

  for (const o of server) mergeCandidate(o);
  for (const o of local) mergeCandidate(o);

  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.date).getTime() || 0;
    const timeB = new Date(b.date).getTime() || 0;
    return timeB - timeA;
  });
};

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pivot' | 'collections' | 'inactive' | 'grades' | 'order' | 'saved_orders'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'cloud' | 'local'>('cloud');
  const [sheetId, setSheetId] = useState<string>('');
  const [editingOrder, setEditingOrder] = useState<SavedOrder | null>(null);
  const [isKeyingIn, setIsKeyingIn] = useState<boolean>(false);
  const [deletedOrderIds, setDeletedOrderIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('ws_deleted_order_ids');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set<string>();
  });
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(() => {
    try {
      let delSet = new Set<string>();
      const delStored = localStorage.getItem('ws_deleted_order_ids');
      if (delStored) {
        const parsedDel = JSON.parse(delStored);
        if (Array.isArray(parsedDel)) delSet = new Set(parsedDel);
      }
      const stored = localStorage.getItem('榮昇_saved_orders');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      // STRICT FILTER: On initial startup, only keep unsubmitted/held drafts from localStorage,
      // and strictly exclude any previously deleted orders.
      return parsed.filter(o => o && o.id && !delSet.has(o.id) && (!o.isKeyedIn || o.isHeld));
    } catch {
      return [];
    }
  });
  const [preSelectedCustomer, setPreSelectedCustomer] = useState<string | null>(null);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<string | null>(() => localStorage.getItem('ws_selected_role') || 'Admin');

  const handleSelectRole = (role: string) => {
    setCurrentRole(role);
    localStorage.setItem('ws_selected_role', role);
  };

  useEffect(() => {
    localStorage.setItem('榮昇_saved_orders', JSON.stringify(savedOrders));
  }, [savedOrders]);

  const activeSavedOrderIdsRef = useRef<Set<string>>(new Set());
  const deletingOrderIdsRef = useRef<Set<string>>(new Set());

  const handleSaveOrder = async (order: SavedOrder) => {
    const activeRole = currentRole || localStorage.getItem('ws_selected_role');
    const existingOrder = savedOrders.find(o => o.id === order.id);
    if (existingOrder && !isOrderOwner(existingOrder, activeRole)) {
      alert(`您只能修改屬於自己的訂單！\n此訂單業務為：${existingOrder.salesName || '未知'}，您目前的身份為：${activeRole || '未選擇'}`);
      return;
    }

    // 1. Mark this order as actively created/saved so sync will never discard it
    activeSavedOrderIdsRef.current.add(order.id);
    recentlySubmittedOrderIds.delete(order.id);

    // Any saved or edited order becomes unkeyed pending new submission to Trade_log
    const orderToSave: SavedOrder = {
      ...order,
      isKeyedIn: false,
      updatedAt: Date.now()
    };

    // 2. Remove order.id from deletedOrderIds state and localStorage if present
    setDeletedOrderIds(prev => {
      const next = new Set(prev);
      next.delete(orderToSave.id);
      localStorage.setItem('ws_deleted_order_ids', JSON.stringify(Array.from(next)));
      return next;
    });

    // 3. Immediately persist into savedOrders and localStorage
    setSavedOrders(prev => {
      const idx = prev.findIndex(o => o.id === orderToSave.id);
      let next: SavedOrder[];
      if (idx !== -1) {
        next = [...prev];
        next[idx] = orderToSave;
      } else {
        next = [orderToSave, ...prev];
      }
      localStorage.setItem('榮昇_saved_orders', JSON.stringify(next));
      return next;
    });

    setEditingOrder(null);
    setActiveTab('saved_orders');

    try {
      await keyInServerOrder(orderToSave.id, false);
      await saveServerOrder(orderToSave);
    } catch (e) {
      console.warn("Failed to sync new order to server:", e);
    }
  };

  const handleEditOrder = (order: SavedOrder) => {
    const activeRole = currentRole || localStorage.getItem('ws_selected_role');
    if (!isOrderOwner(order, activeRole)) {
      alert(`您只能修改屬於自己的訂單！\n此訂單業務為：${order.salesName || '未知'}，您目前的身份為：${activeRole || '未選擇'}`);
      return;
    }

    // When editing an already keyed-in order:
    // Mark it as unkeyed immediately so the order list and server recognize it as unkeyed/being edited!
    recentlySubmittedOrderIds.delete(order.id);
    const unkeyedOrder: SavedOrder = {
      ...order,
      isKeyedIn: false,
      updatedAt: Date.now()
    };
    setSavedOrders(prev => {
      const next = prev.map(o => o.id === order.id ? unkeyedOrder : o);
      localStorage.setItem('榮昇_saved_orders', JSON.stringify(next));
      return next;
    });
    keyInServerOrder(order.id, false).catch(() => {});
    saveServerOrder(unkeyedOrder).catch(() => {});

    setEditingOrder(unkeyedOrder);
    setActiveTab('order');
  };

  const handleToggleKeyIn = async (orderId: string) => {
    const activeRole = currentRole || localStorage.getItem('ws_selected_role');
    const existingOrder = savedOrders.find(o => o.id === orderId);
    if (existingOrder && !isOrderOwner(existingOrder, activeRole)) {
      alert(`您只能為屬於自己的訂單入機！\n此訂單業務為：${existingOrder.salesName || '未知'}，您目前的身份為：${activeRole || '未選擇'}`);
      return;
    }

    let newStatus = false;
    let targetOrder: SavedOrder | undefined;

    setSavedOrders(prev => {
      const next = prev.map(o => {
        if (o.id === orderId) {
          newStatus = !o.isKeyedIn;
          targetOrder = { ...o, isKeyedIn: newStatus, updatedAt: Date.now() };
          return targetOrder;
        }
        return o;
      });
      localStorage.setItem('榮昇_saved_orders', JSON.stringify(next));
      return next;
    });

    if (newStatus) {
      recentlySubmittedOrderIds.add(orderId);
    } else {
      recentlySubmittedOrderIds.delete(orderId);
    }

    if (targetOrder) {
      keyInServerOrder(orderId, newStatus).catch(() => {});
      saveServerOrder(targetOrder).catch(() => {});
    }
  };

  const parseProductPacking = (productName: string): { outerQty: number; outerUnit: string } | null => {
    const match = productName.match(/(\d+)\/([^\s\d/]+)/);
    if (match) {
      const outerQty = parseInt(match[1], 10);
      const outerUnit = match[2];
      if (!isNaN(outerQty) && outerQty > 0) {
        return { outerQty, outerUnit };
      }
    }
    return null;
  };

  const buildTradeRowsForOrder = (order: SavedOrder): any[][] => {
    if (!order.items || order.items.length === 0) return [];
    return order.items.map(item => {
      const parsed = parseProductPacking(item.name);
      let colD_qty = item.quantity;
      let colE_unit = "unit";
      let colF_ref = 1;
      if (parsed && item.quantity % parsed.outerQty === 0) {
        colD_qty = item.quantity / parsed.outerQty;
        colE_unit = parsed.outerUnit;
        colF_ref = parsed.outerQty;
      }
      return [
        "",                         // Col A: Date
        item.name,                  // Col B: Item
        "",                         // Col C: Product ID
        colD_qty,                   // Col D: Quantity
        colE_unit,                  // Col E: Unit
        colF_ref,                   // Col F: Ref
        item.price,                 // Col G: Price
        order.customerName,         // Col H: Customer
        "",                         // Col I: District
        item.quantity * item.price, // Col J: Subtotal
        order.salesName,            // Col K: User
        "",                         // Col L: Status
        order.id                    // Col M: Order ID
      ];
    });
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (deletingOrderIdsRef.current.has(orderId)) return;

    const activeRole = currentRole || localStorage.getItem('ws_selected_role');
    const orderToDelete = savedOrders.find(o => o.id === orderId);
    if (orderToDelete && !isOrderOwner(orderToDelete, activeRole)) {
      alert(`您只能刪除屬於自己的訂單！\n此訂單業務為：${orderToDelete.salesName || '未知'}`);
      return;
    }

    deletingOrderIdsRef.current.add(orderId);
    activeSavedOrderIdsRef.current.delete(orderId);

    // 1. Immediately record in deletedOrderIds state and localStorage
    const nextDeletedSet = new Set(deletedOrderIds).add(orderId);
    setDeletedOrderIds(nextDeletedSet);
    localStorage.setItem('ws_deleted_order_ids', JSON.stringify(Array.from(nextDeletedSet)));

    // 2. Remove immediately from local state and localStorage
    setSavedOrders(prev => {
      const next = prev.filter(o => o.id !== orderId);
      localStorage.setItem('榮昇_saved_orders', JSON.stringify(next));
      return next;
    });

    // 3. Purge from persistent IndexedDB / localStorage trade cache
    purgeDeletedOrdersFromCache([orderId]);

    try {
      // 4. Send delete to server (adds to server tombstone & invalidates server cache)
      const serverDeletedList = await deleteServerOrder(orderId);
      if (Array.isArray(serverDeletedList)) {
        serverDeletedList.forEach(id => nextDeletedSet.add(id));
        setDeletedOrderIds(new Set(nextDeletedSet));
        localStorage.setItem('ws_deleted_order_ids', JSON.stringify(Array.from(nextDeletedSet)));
      }

      // 5. When deleting a keyed-in order (whether held or not):
      // Because putting an order on '暫存' keeps the goods on hold (stock unchanged),
      // deleting the order now releases the reserved goods and replenishes stock in Google Sheet!
      if (orderToDelete && orderToDelete.isKeyedIn) {
        const rowsToSend = buildTradeRowsForOrder(orderToDelete);
        await deleteOrderFromSheet(orderId, rowsToSend);
      }
      loadData(undefined, true);
    } catch (e) {
      console.warn("Failed to delete order:", e);
    } finally {
      deletingOrderIdsRef.current.delete(orderId);
    }
  };

  const handleToggleHold = async (orderId: string) => {
    const activeRole = currentRole || localStorage.getItem('ws_selected_role');
    const order = savedOrders.find(o => o.id === orderId);
    if (!order) return;
    if (!isOrderOwner(order, activeRole)) {
      alert(`您只能暫存或取消暫存屬於自己的訂單！\n此訂單業務為：${order.salesName || '未知'}`);
      return;
    }

    const newIsHeld = !order.isHeld;

    // Update local state - preserve isKeyedIn and toggle isHeld
    setSavedOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, isHeld: newIsHeld } : o
    ));

    try {
      await toggleHoldServerOrder(orderId);
    } catch (e) {
      console.warn("Failed to toggle hold on server:", e);
    }

    // Per user instruction: when '暫存' is pressed, do NOT change the stock level!
    // The goods are on hold for this order, so stock remains reserved/deducted.
  };

  const generateNextOrderId = (userName: string): string => {
    const prefix = userName.trim().toUpperCase();
    if (!prefix || prefix === 'UNKNOWN') return `ORDER-${Date.now()}`;

    let maxNum = 0;

    const parseIdNumericPart = (idString: string) => {
      if (!idString) return;
      const idUpper = idString.toUpperCase().trim();
      if (idUpper.startsWith(prefix)) {
        // e.g. EVA00001 -> numeric part is 00001 -> 1
        // e.g. EVA0002 -> numeric part is 0002 -> 2
        const numPart = idUpper.substring(prefix.length);
        const match = numPart.match(/^\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    };

    // Scan saved orders, deleted orders, and past sales records so an ID is NEVER reused or collides:
    savedOrders.forEach(o => parseIdNumericPart(o.id));
    deletedOrderIds.forEach(id => parseIdNumericPart(id));
    records.forEach(r => parseIdNumericPart(r.orderId));
    try {
      const storedDel = localStorage.getItem('ws_deleted_order_ids');
      if (storedDel) {
        const parsed = JSON.parse(storedDel);
        if (Array.isArray(parsed)) parsed.forEach((id: string) => parseIdNumericPart(id));
      }
    } catch {}

    const nextNum = maxNum + 1;
    // Format: name of user & standard 5-digit padded number starting with 00001
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  };

  const handleKeyInOrders = async (): Promise<boolean> => {
    const activeRole = currentRole || localStorage.getItem('ws_selected_role');
    if (!activeRole) {
      alert("請先選擇登入身份！");
      return false;
    }

    // Each user (admin, eva, katie, kasey, yo) can only key in their OWN orders
    const ordersToKeyIn = savedOrders.filter(
      o => isOrderOwner(o, activeRole) && !o.isHeld && !o.isKeyedIn
    );

    if (ordersToKeyIn.length === 0) {
      alert(`沒有屬於 ${activeRole} 的待入機訂單。`);
      return false;
    }

    setIsKeyingIn(true);
    try {
      const formatDateTime = (date: Date): string => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
      };

      const sentTime = formatDateTime(new Date());
      const adminRows: any[][] = [];
      const regularRows: any[][] = [];

      ordersToKeyIn.forEach(order => {
        const isAdminOrder = order.salesName?.trim().toLowerCase() === 'admin';
        const targetRows = isAdminOrder ? adminRows : regularRows;

        order.items.forEach((item, index) => {
          const remarkCol = index === 0 ? (order.remark || '') : '';
          
          const totalQty = item.quantity;
          const parsed = parseProductPacking(item.name);
          let colD_qty = totalQty;
          let colE_unit = "unit";
          let colF_ref = 1;

          if (parsed) {
            if (totalQty % parsed.outerQty === 0) {
              colD_qty = totalQty / parsed.outerQty;
              colE_unit = parsed.outerUnit;
              colF_ref = parsed.outerQty;
            }
          }

          const custObj = customers.find(c => c.name.trim() === order.customerName.trim());
          const district = custObj?.district || "";
          const subtotal = item.quantity * item.price;

          const matchedProd = products.find(p => p.name.trim() === item.name.trim());
          const productId = matchedProd?.id || "";

          targetRows.push([
            sentTime,             // Col A: Date & time sent
            item.name,            // Col B: Item (product name)
            productId,            // Col C: Product ID (Col B of raw tab)
            colD_qty,             // Col D: Quantity
            colE_unit,            // Col E: Unit
            colF_ref,             // Col F: Ref
            item.price,           // Col G: Price
            order.customerName,   // Col H: Customers name
            district,             // Col I: district
            subtotal,             // Col J: Subtotal
            order.salesName,      // Col K: User name
            "",                   // Col L: Empty placeholder/status
            order.id,             // Col M: Order ID
            remarkCol             // Col N: Remark (備註)
          ]);
        });
      });

      let success = true;
      if (regularRows.length > 0) {
        const res = await writeTradeLogToSheet(regularRows, 'Trade_Log');
        if (!res) success = false;
      }
      if (adminRows.length > 0) {
        const res = await writeTradeLogToSheet(adminRows, 'Trade_log_admin');
        if (!res) success = false;
      }
      if (success) {
        const keyedIds = ordersToKeyIn.map(o => o.id);
        keyedIds.forEach(id => recentlySubmittedOrderIds.add(id));

        setSavedOrders(prev => {
          const next = prev.map(o => {
            if (keyedIds.includes(o.id)) {
              return { ...o, isKeyedIn: true, isHeld: false };
            }
            return o;
          });
          localStorage.setItem('榮昇_saved_orders', JSON.stringify(next));
          return next;
        });

        // Await server batch keyin so server state & file are updated BEFORE background loadData
        await keyInServerOrdersBatch(keyedIds);

        loadData(undefined, true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error auto keying in orders:', err);
      return false;
    } finally {
      setIsKeyingIn(false);
    }
  };

  const loadData = useCallback(async (customId?: string, silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setIsBackgroundSyncing(true);
    }
    setError(null);
    try {
      const [salesResult, customerResult, productResult, serverOrdersData, cloudTradeOrders] = await Promise.all([
        fetchSalesData(customId),
        fetchCustomerGrades(),
        fetchProducts(),
        fetchServerOrders(),
        fetchCloudTradeLogOrders()
      ]);

      const { orders: serverOrdersResult, deletedOrderIds: serverDeletedIds } = serverOrdersData;

      // Update deleted orders tracking
      const activeDeletedSet = new Set<string>();
      try {
        const stored = localStorage.getItem('ws_deleted_order_ids');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) parsed.forEach(id => activeDeletedSet.add(id));
        }
      } catch {}
      serverDeletedIds.forEach(id => activeDeletedSet.add(id));
      activeSavedOrderIdsRef.current.forEach(id => activeDeletedSet.delete(id));
      localStorage.setItem('ws_deleted_order_ids', JSON.stringify(Array.from(activeDeletedSet)));
      setDeletedOrderIds(activeDeletedSet);
      purgeDeletedOrdersFromCache(Array.from(activeDeletedSet));

      const { data, source } = salesResult;
      
      if (data.records.length === 0) {
        if (!silent) setError('No sales records found in the dataset.');
      } else {
        setRecords(data.records);
        setHeaders(data.headers);
        setCustomers(customerResult);
        setProducts(productResult);
        setDataSource(source);
        const calculated = calculateAnalytics(data.records);
        setAnalytics(calculated);

        // Orders in '訂單列表' strictly come ONLY from 'Trade_log' & 'Trade_log_admin'
        setSavedOrders(prev => {
          const cleanedPrev = prev.filter(o => !activeDeletedSet.has(o.id));
          const merged = mergeOrderLists(cleanedPrev, cloudTradeOrders, serverOrdersResult, activeDeletedSet);
          localStorage.setItem('榮昇_saved_orders', JSON.stringify(merged));
          syncServerOrders(merged).catch(() => {});
          return merged;
        });
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'An error occurred while syncing with the database.');
      }
    } finally {
      setLoading(false);
      setIsBackgroundSyncing(false);
    }
  }, []);

  const syncAndRefreshOrders = useCallback(async () => {
    try {
      const [serverOrdersData, cloudTradeOrders] = await Promise.all([
        fetchServerOrders(),
        fetchCloudTradeLogOrders()
      ]);
      const { orders: serverOrdersResult, deletedOrderIds: serverDeletedIds } = serverOrdersData;

      const activeDeletedSet = new Set<string>();
      try {
        const stored = localStorage.getItem('ws_deleted_order_ids');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) parsed.forEach(id => activeDeletedSet.add(id));
        }
      } catch {}
      serverDeletedIds.forEach(id => activeDeletedSet.add(id));
      activeSavedOrderIdsRef.current.forEach(id => activeDeletedSet.delete(id));
      localStorage.setItem('ws_deleted_order_ids', JSON.stringify(Array.from(activeDeletedSet)));
      setDeletedOrderIds(activeDeletedSet);
      purgeDeletedOrdersFromCache(Array.from(activeDeletedSet));

      setSavedOrders(prev => {
        const cleanedPrev = prev.filter(o => !activeDeletedSet.has(o.id));
        const merged = mergeOrderLists(cleanedPrev, cloudTradeOrders, serverOrdersResult, activeDeletedSet);
        localStorage.setItem('榮昇_saved_orders', JSON.stringify(merged));
        return merged;
      });
    } catch (e) {
      console.warn('Failed to refresh orders:', e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'saved_orders') {
      syncAndRefreshOrders();
      const timer = setInterval(() => {
        syncAndRefreshOrders();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [activeTab, syncAndRefreshOrders]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSheetId = params.get('sheetId');
    if (urlSheetId) {
      setSheetId(urlSheetId);
      loadData(urlSheetId, false);
      return;
    }

    let isMounted = true;
    (async () => {
      // 1. Try immediate hydration from persistent cache (<50ms)
      try {
        const [cachedSales, cachedCust, cachedProd, serverOrdersResult, cachedCloudOrders] = await Promise.all([
          getCachedItem<any>('sales_data'),
          getCachedItem<Customer[]>('customers'),
          getCachedItem<Product[]>('products'),
          fetchServerOrders(),
          getCachedItem<SavedOrder[]>('cloud_trade_orders')
        ]);

        if (isMounted && cachedSales && cachedSales.records && cachedSales.records.length > 0) {
          setRecords(cachedSales.records);
          setHeaders(cachedSales.headers);
          setAnalytics(calculateAnalytics(cachedSales.records));
          if (cachedCust && cachedCust.length > 0) setCustomers(cachedCust);
          if (cachedProd && cachedProd.length > 0) setProducts(cachedProd);
          setDataSource('local');
          setLoading(false); // Instantly dismiss the "Syncing Engine" screen!

          const hydrationDeletedSet = new Set<string>();
          try {
            const stored = localStorage.getItem('ws_deleted_order_ids');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) parsed.forEach(id => hydrationDeletedSet.add(id));
            }
          } catch {}
          if (serverOrdersResult?.deletedOrderIds) {
            serverOrdersResult.deletedOrderIds.forEach((id: string) => hydrationDeletedSet.add(id));
          }

          setSavedOrders(prev => {
            const cleanedPrev = prev.filter(o => !hydrationDeletedSet.has(o.id));
            return mergeOrderLists(cleanedPrev, cachedCloudOrders || [], serverOrdersResult?.orders || [], hydrationDeletedSet);
          });

          // Silently revalidate in background to get latest changes without freezing UI
          loadData(undefined, true);
          return;
        }
      } catch (cacheErr) {
        console.warn('Cache pre-hydration warning:', cacheErr);
      }

      // 2. If no cache exists, run standard load with spinner
      if (isMounted) {
        loadData(undefined, false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadData]);

  const handleCustomerAdded = (customerName: string) => {
    loadData();
    setPreSelectedCustomer(customerName);
    setActiveTab('order');
    setEditingOrder(null);
  };

  const NavItems = () => (
    <>
      <button
        onClick={() => { 
          setEditingOrder(null);
          setActiveTab('order'); 
          setIsSidebarOpen(false); 
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'order' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="shrink-0"><Plus className="w-5 h-5" /></div>
        <span className="truncate">落單 Order</span>
      </button>
      <button
        onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="shrink-0"><Layout className="w-5 h-5" /></div>
        <span className="truncate">Dashboard</span>
      </button>
      <button
        onClick={() => { setActiveTab('collections'); setIsSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'collections' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="shrink-0"><ReceiptText className="w-5 h-5" /></div>
        <span className="truncate">及單+未到期票</span>
      </button>
      <button
        onClick={() => { setActiveTab('inactive'); setIsSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'inactive' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="shrink-0"><UserX className="w-5 h-5" /></div>
        <span className="truncate">7天以上冇落單</span>
      </button>
      <button
        onClick={() => { setActiveTab('pivot'); setIsSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'pivot' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="shrink-0"><TableIcon className="w-5 h-5" /></div>
        <span className="truncate">過往三十天銷售記錄</span>
      </button>
      <button
        onClick={() => { setActiveTab('grades'); setIsSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'grades' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="shrink-0"><Award className="w-5 h-5" /></div>
        <span className="truncate">客戶等級</span>
      </button>
      <button
        onClick={() => { setActiveTab('saved_orders'); setIsSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'saved_orders' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        <div className="shrink-0"><ListOrdered className="w-5 h-5" /></div>
        <span className="truncate">訂單列表</span>
      </button>
    </>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse" />
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Syncing Engine...</h2>
        <p className="text-slate-400 mt-3 max-w-xs font-medium">Fetching high-resolution sales data from Google Drive CSV</p>
        <button
          onClick={() => {
            setLoading(false);
          }}
          className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 shadow-md active:scale-95"
        >
          立即以離線模式進入應用程式
        </button>
      </div>
    );
  }

  if (activeTab === 'order') {
    return (
      <OrderEntry 
        key={editingOrder ? `edit-${editingOrder.id}` : `new-order-${currentRole || 'none'}`}
        onBack={() => { setActiveTab('dashboard'); setEditingOrder(null); }} 
        onSaveOrder={handleSaveOrder} 
        onShowOrderList={() => { setActiveTab('saved_orders'); setEditingOrder(null); }}
        editingOrder={editingOrder}
        onGenerateOrderId={generateNextOrderId}
        initialCustomers={customers}
        initialProducts={products}
        savedOrders={savedOrders}
        preSelectedCustomer={preSelectedCustomer}
        onClearPreSelectedCustomer={() => setPreSelectedCustomer(null)}
        onCustomerAdded={handleCustomerAdded}
        onProductAdded={(newProd) => setProducts(prev => [newProd, ...prev.filter(p => p.name !== newProd.name)])}
        currentRole={currentRole}
        onSelectRole={handleSelectRole}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row relative">
      <header className="md:hidden bg-slate-900 text-white px-3 py-2 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-blue-600 rounded-md">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight">榮昇銷售數據</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={currentRole || ''}
            onChange={(e) => handleSelectRole(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none"
            title="切換登入身份"
          >
            {APP_USERS.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-800 rounded-md transition-colors">
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed md:sticky top-0 left-0 z-50 h-full w-72 bg-[#0f172a] text-white p-6 flex flex-col transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:w-64
      `}>
        <div className="hidden md:flex items-center gap-2.5 mb-5">
          <div className="p-1.5 bg-blue-600 rounded-md shadow-md shadow-blue-600/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h1 className="text-base font-bold tracking-tight">榮昇銷售數據</h1>
        </div>

        {/* Global User Role Indicator & Switcher */}
        <div className="mb-4 px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <UserCircle className="w-3.5 h-3.5 text-blue-400" />
              登入身份 (User)
            </span>
          </div>
          <select
            value={currentRole || ''}
            onChange={(e) => handleSelectRole(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {APP_USERS.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <nav className="flex-1 space-y-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-4">Navigation</div>
          <NavItems />
          
          <div className="pt-8 pb-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-4 flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> Data Connection
            </div>
            <div className="px-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400">Sheet ID or URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    placeholder="Paste ID..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button 
                    onClick={() => loadData(sheetId)}
                    className="p-1.5 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400">Status</span>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${dataSource === 'cloud' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {dataSource === 'cloud' ? <Globe className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />}
                    {dataSource === 'cloud' ? 'Live' : 'Local'}
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 leading-tight">
                  {dataSource === 'cloud' ? 'Connected to Google Drive CSV' : 'Using backup local data.csv'}
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
           <p className="text-[10px] text-slate-500 font-medium text-center italic">榮昇銷售數據 v2.5 Pro</p>
        </div>
      </aside>

      <main className="flex-1 p-2 sm:p-4 md:p-8 lg:p-10 pb-28 md:pb-10 min-h-0 w-full">
        <div className="max-w-7xl mx-auto">
          {activeTab !== 'saved_orders' && (
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${dataSource === 'cloud' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${dataSource === 'cloud' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {dataSource === 'cloud' ? 'Live Cloud Sync' : 'Offline Mode (Local)'}
                  </span>
                  {isBackgroundSyncing && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-600" />
                      <span>後台同步中...</span>
                    </div>
                  )}
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                  {activeTab === 'dashboard' ? '' : 
                   activeTab === 'pivot' ? '過往三十天銷售記錄' : 
                   activeTab === 'collections' ? '及單+未到期票' : 
                   activeTab === 'inactive' ? '7天以上冇落單' : 
                   activeTab === 'grades' ? '客戶等級' : 
                   'Transaction Log'}
                </h2>
              </div>
              
              {/* AI Analysis button removed */}
            </header>
          )}

          {error ? (
            <div className="bg-red-50 border border-red-100 text-red-800 p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 shadow-sm">
              <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-black mb-2">Sync Error Detected</h3>
                <p className="text-red-600/80 font-medium leading-relaxed max-w-lg">{error}</p>
                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                  <button onClick={() => loadData()} className="px-8 py-3 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">Reconnect Now</button>
                </div>
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white border border-slate-200 p-16 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                <FileQuestion className="w-12 h-12 text-slate-300" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800">No Data Synchronized</h3>
                <p className="text-slate-500 mt-2 max-w-md font-medium">The source was accessed successfully but contains no usable records. Check your Google Drive CSV structure.</p>
              </div>
            </div>
          ) : activeTab === 'dashboard' && analytics ? (
            <Dashboard analytics={analytics} />
          ) : activeTab === 'collections' ? (
            <CollectionsTable data={records} />
          ) : activeTab === 'inactive' ? (
            <InactiveCustomers data={records} masters={customers} />
          ) : activeTab === 'grades' ? (
            <CustomerGrades onCustomerAdded={handleCustomerAdded} />
          ) : activeTab === 'pivot' ? (
            <PivotTable data={records} headers={headers} products={products} />
          ) : activeTab === 'saved_orders' ? (
            <OrderList 
              orders={savedOrders} 
              onEditOrder={handleEditOrder} 
              onDeleteOrder={handleDeleteOrder}
              onToggleHold={handleToggleHold}
              onToggleKeyIn={handleToggleKeyIn}
              currentRole={currentRole}
              onSelectRole={handleSelectRole}
              onNewOrder={() => { setEditingOrder(null); setActiveTab('order'); }}
              onKeyInOrders={handleKeyInOrders}
              isKeyingIn={isKeyingIn}
              onRefreshOrders={syncAndRefreshOrders}
            />
          ) : (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Reference</th>
                      <th className="px-8 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Date</th>
                      <th className="px-8 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Client</th>
                      <th className="px-8 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Item Description</th>
                      <th className="px-8 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {records.slice(0, 100).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5 text-slate-900 font-black tabular-nums">{row.orderId}</td>
                        <td className="px-8 py-5 text-slate-500 font-medium">{new Date(row.orderDate).toLocaleDateString()}</td>
                        <td className="px-8 py-5 text-slate-800 font-bold">{row.customerName}</td>
                        <td className="px-8 py-5 text-slate-500 truncate max-w-[250px]">{row.productName}</td>
                        <td className="px-8 py-5 text-right text-slate-900 font-black tabular-nums text-base">${row.sales.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-8 text-center border-t border-slate-50 bg-slate-50/30">
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Showing top 100 live cloud records</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around p-2 z-30 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400'}`}
        >
          <Layout className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">Hub</span>
        </button>
        <button 
          onClick={() => setActiveTab('collections')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'collections' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400'}`}
        >
          <ReceiptText className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">Dues</span>
        </button>
        <button 
          onClick={() => setActiveTab('inactive')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'inactive' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400'}`}
        >
          <UserX className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">7天以上</span>
        </button>
        <button 
          onClick={() => setActiveTab('pivot')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'pivot' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400'}`}
        >
          <TableIcon className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">Pivot</span>
        </button>
        <button 
          onClick={() => setActiveTab('grades')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'grades' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400'}`}
        >
          <Award className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">等級</span>
        </button>
        <button 
          onClick={() => setActiveTab('saved_orders')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'saved_orders' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400'}`}
        >
          <ListOrdered className="w-6 h-6" />
          <span className="text-[9px] font-black uppercase tracking-widest">訂單</span>
        </button>
      </nav>
      <div className="h-20 md:hidden" />

      {/* Floating Action Button for order entry */}
      <button
        onClick={() => {
          setEditingOrder(null);
          setActiveTab('order');
        }}
        className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-40 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group flex items-center gap-2 overflow-hidden max-w-[56px] hover:max-w-[150px]"
      >
        <Plus className="w-6 h-6 shrink-0" />
        <span className="font-black text-xs uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">落單</span>
      </button>
    </div>
  );
};

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-3">出現錯誤 / App Error</h2>
            <p className="text-xs text-slate-300 mb-6 bg-slate-950 p-3 rounded-xl font-mono overflow-auto max-h-32 text-left">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('ws_selected_role');
                window.location.reload();
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 px-6 rounded-2xl font-bold text-sm transition-all"
            >
              重置並重新載入 / Reset & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const AppWithErrorBoundary: React.FC = () => (
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

export default AppWithErrorBoundary;
