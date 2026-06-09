
import React, { useState, useEffect, useCallback } from 'react';
import { fetchSalesData, calculateAnalytics, fetchCustomerGrades, writeTradeLogToSheet, deleteOrderFromSheet, fetchProducts } from './services/dataService';
import { SaleRecord, SalesAnalytics, SavedOrder, Customer, Product } from './types';
import Dashboard from './components/Dashboard';
import PivotTable from './components/PivotTable';
import CollectionsTable from './components/CollectionsTable';
import InactiveCustomers from './components/InactiveCustomers';
import CustomerGrades from './components/CustomerGrades';
import OrderEntry from './components/OrderEntry';
import OrderList from './components/OrderList';
import { Layout, BarChart3, Database, RefreshCw, AlertCircle, Loader2, Table as TableIcon, Menu, X, FileQuestion, Globe, HardDrive, Settings2, ReceiptText, UserX, Award, Plus, ListOrdered } from 'lucide-react';

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
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>(() => {
    const stored = localStorage.getItem('榮昇_saved_orders');
    return stored ? JSON.parse(stored) : [];
  });
  const [preSelectedCustomer, setPreSelectedCustomer] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('榮昇_saved_orders', JSON.stringify(savedOrders));
  }, [savedOrders]);

  const handleSaveOrder = (order: SavedOrder) => {
    setSavedOrders(prev => {
      const idx = prev.findIndex(o => o.id === order.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = order;
        return next;
      }
      return [order, ...prev];
    });
    setEditingOrder(null);
    setActiveTab('saved_orders');
  };

  const handleEditOrder = (order: SavedOrder) => {
    setEditingOrder(order);
    setActiveTab('order');
  };

  const handleDeleteOrder = (orderId: string) => {
    setSavedOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleToggleHold = async (orderId: string) => {
    const order = savedOrders.find(o => o.id === orderId);
    if (!order) return;

    const newIsHeld = !order.isHeld;

    // Update local state
    setSavedOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, isHeld: newIsHeld, isKeyedIn: newIsHeld ? false : o.isKeyedIn } : o
    ));

    if (newIsHeld) {
      try {
        await deleteOrderFromSheet(orderId);
        // Refresh the local data to reflect deletion/updates
        loadData();
      } catch (err) {
        console.error("Failed to delete held order from sheet:", err);
      }
    }
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

    // 1. Scan sheet records (orderId)
    records.forEach(r => parseIdNumericPart(r.orderId));

    // 2. Scan saved local orders (id)
    savedOrders.forEach(o => parseIdNumericPart(o.id));

    const nextNum = maxNum + 1;
    // Format: name of user & standard 5-digit padded number starting with 00001
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  };

  const handleKeyInOrders = async (): Promise<boolean> => {
    const activeRole = localStorage.getItem('ws_selected_role');
    if (!activeRole) return false;

    const ordersToKeyIn = savedOrders.filter(
      o => (activeRole === 'Admin' || o.salesName === activeRole) && !o.isHeld && !o.isKeyedIn
    );

    if (ordersToKeyIn.length === 0) return false;

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

      const sentTime = formatDateTime(new Date());
      const rowsToSend: any[][] = [];

      ordersToKeyIn.forEach(order => {
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

          rowsToSend.push([
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

      const success = await writeTradeLogToSheet(rowsToSend);
      if (success) {
        setSavedOrders(prev => prev.map(o => {
          const shouldMark = ordersToKeyIn.some(toKey => toKey.id === o.id);
          return shouldMark ? { ...o, isKeyedIn: true } : o;
        }));
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


  const loadData = useCallback(async (customId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [salesResult, customerResult, productResult] = await Promise.all([
        fetchSalesData(customId),
        fetchCustomerGrades(),
        fetchProducts()
      ]);

      const { data, source } = salesResult;
      
      if (data.records.length === 0) {
        setError('No sales records found in the dataset.');
      } else {
        setRecords(data.records);
        setHeaders(data.headers);
        setCustomers(customerResult);
        setProducts(productResult);
        setDataSource(source);
        const calculated = calculateAnalytics(data.records);
        setAnalytics(calculated);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while syncing with the database.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSheetId = params.get('sheetId');
    if (urlSheetId) {
      setSheetId(urlSheetId);
      loadData(urlSheetId);
    } else {
      loadData();
    }
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
      </div>
    );
  }

  if (activeTab === 'order') {
    return (
      <OrderEntry 
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
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row relative">
      <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">榮昇銷售數據</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
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
        <div className="hidden md:flex items-center gap-3 mb-10">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">榮昇銷售數據</h1>
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

      <main className="flex-1 p-2 sm:p-4 md:p-8 lg:p-10 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {activeTab !== 'saved_orders' && (
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${dataSource === 'cloud' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${dataSource === 'cloud' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {dataSource === 'cloud' ? 'Live Cloud Sync' : 'Offline Mode (Local)'}
                  </span>
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
              orders={
                localStorage.getItem('ws_selected_role') === 'Admin'
                  ? savedOrders
                  : savedOrders.filter(o => o.salesName === localStorage.getItem('ws_selected_role'))
              } 
              onEditOrder={handleEditOrder} 
              onDeleteOrder={handleDeleteOrder}
              onToggleHold={handleToggleHold}
              currentRole={localStorage.getItem('ws_selected_role')}
              onNewOrder={() => { setEditingOrder(null); setActiveTab('order'); }}
              onKeyInOrders={handleKeyInOrders}
              isKeyingIn={isKeyingIn}
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

export default App;
