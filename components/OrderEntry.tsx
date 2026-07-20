
import React, { useState, useEffect, useMemo } from 'react';
import { User, ShieldCheck, ArrowLeft, ShoppingCart, ChevronRight, Search, Loader2, Plus, Minus, Trash2, Package, Box, Check, Star, ListOrdered, UserPlus, PackagePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchCustomerGrades, fetchProducts, addCustomerToSheet, addProductToSheet } from '../services/dataService';
import { Product, OrderItem, Customer, SavedOrder } from '../types';

interface OrderEntryProps {
  onBack: () => void;
  onSaveOrder?: (order: SavedOrder) => void;
  onShowOrderList?: () => void;
  editingOrder?: SavedOrder | null;
  onGenerateOrderId?: (userName: string) => string;
  initialCustomers?: Customer[];
  initialProducts?: Product[];
  savedOrders?: SavedOrder[];
  preSelectedCustomer?: string | null;
  onClearPreSelectedCustomer?: () => void;
  onCustomerAdded?: (name: string) => void;
}

const OrderEntry: React.FC<OrderEntryProps> = ({ 
  onBack, 
  onSaveOrder, 
  onShowOrderList, 
  editingOrder, 
  onGenerateOrderId, 
  initialCustomers,
  initialProducts,
  savedOrders = [],
  preSelectedCustomer = null,
  onClearPreSelectedCustomer,
  onCustomerAdded
}) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(() => {
    if (editingOrder?.salesName) return editingOrder.salesName;
    return localStorage.getItem('ws_selected_role');
  });
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(editingOrder?.customerName || preSelectedCustomer || null);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers || []);

  useEffect(() => {
    if (initialCustomers && initialCustomers.length > 0) {
      setCustomers(initialCustomers);
    }
  }, [initialCustomers]);

  useEffect(() => {
    if (preSelectedCustomer) {
      setSelectedCustomer(preSelectedCustomer);
      onClearPreSelectedCustomer?.();
    }
  }, [preSelectedCustomer, onClearPreSelectedCustomer]);

  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>(editingOrder?.items || []);
  const [remark, setRemark] = useState(editingOrder?.remark || '');
  const [showRemarkInput, setShowRemarkInput] = useState(!!editingOrder?.remark);
  const [tempPrices, setTempPrices] = useState<Record<string, string>>({});

  const toggleRemarkKeyword = (keyword: string, checked: boolean) => {
    if (checked) {
      setRemark(prev => {
        const trimmed = prev.trim();
        if (trimmed.includes(keyword)) return prev;
        return trimmed ? `${trimmed} ${keyword}` : keyword;
      });
    } else {
      setRemark(prev => {
        // Build regex that safely removes the keyword and normalizes spacing around it
        const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\s*${escaped}\\s*`, 'g');
        const updated = prev.replace(regex, ' ').trim();
        return updated;
      });
    }
  };

  const [favorites, setFavorites] = useState<Product[]>([]);

  // Load favorites when role changes or on mount
  useEffect(() => {
    if (!selectedRole) {
      setFavorites([]);
      return;
    }
    const key = `ws_favorites_${selectedRole}`;
    const savedFavorites = localStorage.getItem(key);
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Failed to parse favorites', e);
        setFavorites([]);
      }
    } else {
      setFavorites([]);
    }
  }, [selectedRole]);

  const [activeTab, setActiveTab] = useState<'order' | 'favorites'>('order');
  const [productsLoading, setProductsLoading] = useState(initialProducts && initialProducts.length > 0 ? false : true);
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Modal states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerDistrict, setNewCustomerDistrict] = useState('九龍東');
  const [newCustomerGrade, setNewCustomerGrade] = useState<'A' | 'B' | 'C'>('C');
  const [newProductName, setNewProductName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const salesPeople = ['EVA', 'KATIE', 'YO', 'KASEY'];
  const districts = ['新界東', '新界西', '九龍東', '九龍西', '港島'];

  const districtCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    districts.forEach(d => counts[d] = 0);
    
    customers.forEach(c => {
      const isVisible = selectedRole === 'Admin' 
        ? ['落鋪', 'HKTVMALL', '其他'].includes(c.name)
        : c.sales.toUpperCase() === (selectedRole || '').toUpperCase();
      
      if (isVisible && c.district) {
        if (counts[c.district] !== undefined) {
          counts[c.district]++;
        }
      }
    });
    return counts;
  }, [customers, selectedRole, districts]);

  useEffect(() => {
    const loadData = async () => {
      if (initialProducts && initialProducts.length > 0) {
        setProducts(initialProducts);
        setProductsLoading(false);
        return;
      }
      setProductsLoading(true);
      try {
        const productData = await fetchProducts();
        setProducts(productData);
      } catch (e) {
        console.error('Failed to load data', e);
      } finally {
        setProductsLoading(false);
      }
    };
    loadData();
  }, [initialProducts]);

  // Save favorites to localStorage
  useEffect(() => {
    if (selectedRole) {
      localStorage.setItem(`ws_favorites_${selectedRole}`, JSON.stringify(favorites));
    }
  }, [favorites, selectedRole]);

  // Save selected role to localStorage
  useEffect(() => {
    if (selectedRole) {
      localStorage.setItem('ws_selected_role', selectedRole);
    }
  }, [selectedRole]);

  // Reset district search when role changes
  useEffect(() => {
    setSelectedDistrict(null);
    setSearchQuery('');
  }, [selectedRole]);

  const parseOuterBoxInfo = (name: string) => {
    if (name.includes('/')) {
      const match = name.match(/(\d+)\/([^\s\x00-\x1F\x7F]+)/);
      if (match) {
        return {
          units: parseInt(match[1]),
          unitName: match[2].charAt(0)
        };
      }
    }
    return null;
  };

  const selectedCustomerInfo = useMemo(() => {
    return customers.find(c => c.name === selectedCustomer);
  }, [customers, selectedCustomer]);

  const getRemainingStock = (product: Product) => {
    if (product.unlimitedStock) return Infinity;
    const baseStock = product.stock ?? 0;
    
    let reducedQty = 0;
    if (savedOrders) {
      savedOrders.forEach(order => {
        if (order.isKeyedIn) {
          return;
        }
        if (editingOrder && order.id === editingOrder.id) {
          return;
        }
        order.items.forEach(item => {
          if (item.name === product.name) {
            reducedQty += item.quantity;
          }
        });
      });
    }

    selectedItems.forEach(item => {
      if (item.name === product.name) {
        reducedQty += item.quantity;
      }
    });

    return Math.max(0, baseStock - reducedQty);
  };

  const getProductStockLimit = (productName: string) => {
    const prod = products.find(p => p.name === productName);
    if (!prod) return Infinity;
    if (prod.unlimitedStock) return Infinity;
    
    let reducedQty = 0;
    if (savedOrders) {
      savedOrders.forEach(order => {
        if (order.isKeyedIn) {
          return;
        }
        if (editingOrder && order.id === editingOrder.id) {
          return;
        }
        order.items.forEach(item => {
          if (item.name === productName) {
            reducedQty += item.quantity;
          }
        });
      });
    }
    return Math.max(0, (prod.stock ?? 0) - reducedQty);
  };

  const handleAddProduct = (product: Product) => {
    const remaining = getRemainingStock(product);
    const isUnlimited = !!product.unlimitedStock;
    if (!isUnlimited && remaining <= 0) {
      alert('該產品已無庫存！');
      return;
    }

    const boxInfo = parseOuterBoxInfo(product.name);
    // Determine price based on selected customer's grade
    const grade = selectedCustomerInfo?.grade || 'C';
    const tieredPrice = product.prices ? product.prices[grade] : (product.price || 0);

    const defaultQty = boxInfo ? boxInfo.units : 12;
    const qtyToAdd = isUnlimited ? defaultQty : Math.min(defaultQty, remaining);

    const newItem: OrderItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: product.name,
      // Default to 1 outer (either parsed or fallback 12) per user request (capped by remaining stock)
      quantity: qtyToAdd,
      price: tieredPrice,
      isOuterBox: true, // Start in outer mode
      unitsPerBox: boxInfo ? boxInfo.units : 12,
      outerBoxUnit: boxInfo ? boxInfo.unitName : "打"
    };
    setSelectedItems(prev => [newItem, ...prev]);
    setProductSearchQuery(''); // Clear search after adding
  };

  const handleUpdateItem = (id: string, updates: Partial<OrderItem>) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.id === id) {
        const merged = { ...item, ...updates };
        const limit = getProductStockLimit(item.name);
        if (merged.quantity > limit) {
          merged.quantity = limit;
          alert(`庫存不足！該產品最大可用庫存爲 ${limit}`);
        }
        return merged;
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleFavorite = (product: Product) => {
    setFavorites(prev => {
      const isFav = prev.some(p => p.name === product.name);
      if (isFav) {
        return prev.filter(p => p.name !== product.name);
      }
      return [...prev, product];
    });
  };

  const isFavorite = (productName: string) => {
    return favorites.some(p => p.name === productName);
  };

  const handleFinalSave = () => {
    if (!selectedCustomer || selectedItems.length === 0) return;
    
    const totalAmount = selectedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const activeUserName = selectedRole || 'Unknown';
    const computedId = editingOrder?.id || onGenerateOrderId?.(activeUserName) || `${Date.now()}`;
    
    const order: SavedOrder = {
      id: computedId,
      date: editingOrder?.date || new Date().toISOString(),
      customerName: selectedCustomer,
      orderAmount: totalAmount,
      salesName: activeUserName,
      remark: remark,
      items: selectedItems,
      isKeyedIn: false
    };
    
    onSaveOrder?.(order);
    // Reset state
    setSelectedItems([]);
    setRemark('');
    setSelectedCustomer(null);
  };

  const handleAddCustomerConfirm = async () => {
    if (!newCustomerName.trim() || !selectedRole) return;
    setIsSubmitting(true);
    const addedCustomerName = newCustomerName.trim();
    try {
      const success = await addCustomerToSheet(addedCustomerName, selectedRole, newCustomerDistrict, newCustomerGrade);
      if (success) {
        // Refresh customer list
        const customerData = await fetchCustomerGrades();
        setCustomers(customerData);
        setSelectedCustomer(addedCustomerName);
        if (onCustomerAdded) {
          onCustomerAdded(addedCustomerName);
        }
        setNewCustomerName('');
        setShowAddCustomerModal(false);
        alert('客戶已成功添加！');
      }
    } catch (error) {
      console.error('Failed to add customer:', error);
      alert('添加客戶失敗，請重試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddProductConfirm = async () => {
    if (!newProductName.trim()) return;
    setIsSubmitting(true);
    try {
      const activeUser = selectedRole || 'Unknown';
      const success = await addProductToSheet(newProductName.trim(), activeUser);
      if (success) {
        // Refresh product list
        const productData = await fetchProducts();
        setProducts(productData);
        setNewProductName('');
        setShowAddProductModal(false);
        alert('產品已成功添加！');
      }
    } catch (error) {
      console.error('Failed to add product:', error);
      alert('添加產品失敗，請重試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return [];
    const query = productSearchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(query));
  }, [products, productSearchQuery]);

  const filteredCustomers = useMemo(() => {
    if (!selectedRole) return [];
    
    let baseList: Customer[] = [];
    if (selectedRole === 'Admin') {
      baseList = customers.filter(c => ['落鋪', 'HKTVMALL', '其他'].includes(c.name));
    } else {
      baseList = customers.filter(c => c.sales.toUpperCase() === selectedRole.toUpperCase());
    }

    if (selectedDistrict) {
      baseList = baseList.filter(c => c.district === selectedDistrict);
    }

    let result = baseList;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = baseList.filter(c => 
        c.name.toLowerCase().includes(query) || 
        (selectedRole === 'Admin' && c.sales.toLowerCase().includes(query))
      );
    }

    return [...result].sort((a, b) => a.name.localeCompare(b.name, 'zh-HK'));
  }, [customers, selectedRole, searchQuery, selectedDistrict]);

  const renderModals = () => (
    <>
      {/* Add Customer Modal */}
      <AnimatePresence>
        {showAddCustomerModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddCustomerModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-2xl">
                  <UserPlus className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Add New Customer</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adding to customer_cat (Col A)</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Customer Name</label>
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Enter customer name..."
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">District / 區域</label>
                  <div className="grid grid-cols-3 gap-2">
                    {districts.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNewCustomerDistrict(d)}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition-all border ${
                          newCustomerDistrict === d
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/10'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Customer Grade / 客戶級別 (Col C)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['A', 'B', 'C'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setNewCustomerGrade(g)}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition-all border ${
                          newCustomerGrade === g
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/10'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {g} 級
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowAddCustomerModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-xs font-black text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={handleAddCustomerConfirm}
                    disabled={isSubmitting || !newCustomerName.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    CONFIRM
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProductModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddProductModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-100 rounded-2xl">
                  <PackagePlus className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">登記新貨品</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adding to raw (Col C)</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Product Name</label>
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Enter product name..."
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowAddProductModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-xs font-black text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={handleAddProductConfirm}
                    disabled={isSubmitting || !newProductName.trim()}
                    className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    CONFIRM
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  if (selectedCustomer) {
    return (
      <div className="min-h-screen w-full bg-white animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col overflow-x-hidden">
        {/* Top Layer: Product Search Box */}
        <div className="sticky top-0 z-[55] bg-white/80 backdrop-blur-md px-2 sm:px-4 py-2 border-b border-slate-50 shadow-sm">
          <div className="w-full max-w-md mx-auto relative flex items-center gap-2">
            <button 
              onClick={() => setSelectedCustomer(null)}
              className="p-1.5 -ml-1 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="落單"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300 shadow-inner"
              />
            </div>
            <button
              onClick={() => setShowAddProductModal(true)}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex-shrink-0"
              title="登記新貨品"
            >
              <PackagePlus className="w-4 h-4" />
            </button>
            {onShowOrderList && (
              <button 
                onClick={onShowOrderList}
                className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex-shrink-0"
                title="Order List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {productSearchQuery && (
            <div className="max-w-md mx-auto relative">
              <div 
                onScroll={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onTouchMove={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-[50vh] overflow-y-auto custom-scrollbar ring-8 ring-black/5"
              >
                {productsLoading ? (
                  <div className="p-4 text-center text-slate-300">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Searching...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                    找不到產品
                  </div>
                ) : (
                  filteredProducts.map((p, idx) => {
                    const remaining = getRemainingStock(p);
                    const isUnlimited = !!p.unlimitedStock;
                    const isOutOfStock = !isUnlimited && remaining <= 0;
                    return (
                      <div
                        key={idx}
                        onClick={() => !isOutOfStock && handleAddProduct(p)}
                        className={`w-full flex items-center justify-between p-3 border-b border-slate-50 last:border-none transition-colors group text-left cursor-pointer ${
                          isOutOfStock ? 'opacity-50 hover:bg-transparent cursor-not-allowed' : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(p);
                            }}
                            className={`p-1 rounded-md transition-colors ${
                              isFavorite(p.name) ? 'text-yellow-400' : 'text-slate-200 hover:text-yellow-200'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${isFavorite(p.name) ? 'fill-current' : ''}`} />
                          </button>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-[11px] font-bold leading-snug break-words ${
                              isOutOfStock ? 'text-slate-400' : 'text-slate-700 group-hover:text-blue-700'
                            }`}>{p.name}</span>
                            <span className={`text-[9px] font-semibold mt-0.5 ${
                              isOutOfStock ? 'text-red-500' : (remaining < 10 && !isUnlimited) ? 'text-amber-600' : 'text-slate-400'
                            }`}>
                              {isUnlimited ? '庫存: 無限制' : isOutOfStock ? '庫存: 已售罄' : `剩餘庫存: ${remaining}`}
                            </span>
                          </div>
                        </div>
                        <div className={`p-1 rounded-lg transition-colors ${
                          isOutOfStock ? 'bg-slate-50' : 'bg-slate-100 group-hover:bg-blue-100'
                        }`}>
                          <Plus className={`w-3 h-3 ${isOutOfStock ? 'text-slate-200' : 'text-slate-400 group-hover:text-blue-500'}`} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content: Selected Products or Favorites */}
        <div className="flex-1 overflow-hidden bg-slate-50/30 flex flex-col relative">
          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'order' ? (
                <motion.div
                  key="order-tab"
                  initial={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute inset-0 overflow-y-auto px-2 sm:px-4 pt-3 pb-40 sm:pb-36 md:pb-28 custom-scrollbar"
                >
                  <div className="max-w-md mx-auto">
                    <div className="space-y-4">
                      <div className="flex flex-col px-1">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{selectedCustomer}</span> 
                            <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">Grade {selectedCustomerInfo?.grade}</span>
                            <span className="flex items-center justify-center min-w-[16px] h-4 bg-slate-200 text-slate-600 text-[8px] rounded-full px-1 flex-shrink-0">{selectedItems.length}</span>
                          </h4>
                          {selectedItems.length > 0 && (
                            <button 
                              onClick={handleFinalSave}
                              className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all group shrink-0"
                              title="Place Order"
                            >
                              <Check className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button 
                            onClick={() => setShowRemarkInput(!showRemarkInput)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                              remark 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                          >
                            <Check className={`w-3 h-3 ${remark ? 'block' : 'hidden'}`} />
                            {remark ? '已添加備註' : '+ 備註'}
                          </button>

                          {/* Quick Select Remark Checkboxes next to the button */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg max-w-full">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors select-none">
                              <input
                                type="checkbox"
                                checked={remark.includes('收及單')}
                                onChange={(e) => toggleRemarkKeyword('收及單', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500/20 cursor-pointer"
                              />
                              收及單
                            </label>
                            <div className="h-3 w-px bg-slate-200" />
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors select-none">
                              <input
                                type="checkbox"
                                checked={remark.includes('明天送')}
                                onChange={(e) => toggleRemarkKeyword('明天送', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500/20 cursor-pointer"
                              />
                              明天送
                            </label>
                            <div className="h-3 w-px bg-slate-200" />
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors select-none">
                              <input
                                type="checkbox"
                                checked={remark.includes('COD')}
                                onChange={(e) => toggleRemarkKeyword('COD', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500/20 cursor-pointer"
                              />
                              COD
                            </label>
                            <div className="h-3 w-px bg-slate-200" />
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors select-none">
                              <input
                                type="checkbox"
                                checked={remark.includes('原板落, 不搬')}
                                onChange={(e) => toggleRemarkKeyword('原板落, 不搬', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500/20 cursor-pointer"
                              />
                              原板落, 不搬
                            </label>
                          </div>

                          {remark && (
                            <button onClick={() => setRemark('')} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-700 transition-colors">Clear</button>
                          )}
                        </div>
                      </div>

                      {showRemarkInput && (
                        <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: 'auto', opacity: 1 }}
                           className="px-1 mt-2 mb-4 overflow-hidden"
                         >
                           <textarea
                             placeholder="Input text remarks (Sales name, specific delivery instructions etc.)..."
                             value={remark}
                             onChange={(e) => setRemark(e.target.value)}
                             className="w-full bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2 text-base font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[60px]"
                           />
                         </motion.div>
                       )}
 
                       {selectedItems.length === 0 ? (
                         <div className="p-20 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-slate-200 gap-4 mt-4 text-center">
                           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                             <Package className="w-8 h-8 opacity-20" />
                           </div>
                           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">No items selected</p>
                           <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">Search products or add from favorites</p>
                         </div>
                       ) : (
                         <div className="space-y-4">
                           {selectedItems.map((item) => (
                             <div key={item.id} className="bg-white border border-slate-100 rounded-xl p-2 shadow-sm hover:shadow-md transition-all group">
                               <div className="flex items-center justify-between gap-2 mb-2">
                                 <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                   <button
                                     onClick={() => {
                                       const prod = products.find(p => p.name === item.name);
                                       if (prod) toggleFavorite(prod);
                                     }}
                                     className={`p-1 rounded-md transition-colors flex-shrink-0 ${
                                       isFavorite(item.name) ? 'text-yellow-400' : 'text-slate-200 hover:text-yellow-200'
                                     }`}
                                   >
                                     <Star className={`w-3.5 h-3.5 ${isFavorite(item.name) ? 'fill-current' : ''}`} />
                                   </button>
                                   <h5 className="text-[11px] font-black text-slate-900 leading-tight truncate">{item.name}</h5>
                                 </div>
                                 {item.unitsPerBox && (
                                   <div className="flex p-0.5 bg-slate-100 rounded-lg flex-shrink-0">
                                     <button
                                       onClick={() => handleUpdateItem(item.id, { isOuterBox: false, quantity: 1 })}
                                       className={`px-2 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
                                         !item.isOuterBox 
                                           ? 'bg-white text-blue-600 shadow-sm' 
                                           : 'text-slate-400 hover:text-slate-600'
                                       }`}
                                     >
                                       單位
                                     </button>
                                     <button
                                       onClick={() => handleUpdateItem(item.id, { isOuterBox: true, quantity: item.unitsPerBox || 12 })}
                                       className={`px-2 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
                                         item.isOuterBox 
                                           ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20' 
                                           : 'text-slate-400 hover:text-slate-600'
                                       }`}
                                     >
                                       {item.outerBoxUnit || '箱'}
                                     </button>
                                   </div>
                                 )}
                               </div>
 
                               <div className="flex items-center gap-1.5">
                                 <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden w-20 flex-shrink-0">
                                   <button 
                                     onClick={() => {
                                       const step = (item.isOuterBox && item.outerBoxUnit !== '打') ? (item.unitsPerBox || 1) : 1;
                                       handleUpdateItem(item.id, { quantity: Math.max(0, item.quantity - step) });
                                     }}
                                     className="px-1 py-1 text-slate-400 hover:text-blue-600 transition-colors"
                                   >
                                     <Minus className="w-2.5 h-2.5" />
                                   </button>
                                   <input
                                     type="number"
                                     value={item.quantity}
                                     onChange={(e) => handleUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                     className="w-full text-center bg-transparent text-base font-bold text-slate-900 focus:outline-none tabular-nums min-w-0"
                                   />
                                   <button 
                                     onClick={() => {
                                       const step = (item.isOuterBox && item.outerBoxUnit !== '打') ? (item.unitsPerBox || 1) : 1;
                                       handleUpdateItem(item.id, { quantity: item.quantity + step });
                                     }}
                                     className="px-1 py-1 text-slate-400 hover:text-blue-600 transition-colors"
                                   >
                                     <Plus className="w-2.5 h-2.5" />
                                   </button>
                                 </div>
 
                                 <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-1 py-1 w-16 flex-shrink-0">
                                   <span className="text-slate-400 text-[8px] font-bold mr-0.5">$</span>
                                   <input
                                     type="text"
                                     inputMode="decimal"
                                     value={tempPrices[item.id] !== undefined ? tempPrices[item.id] : item.price}
                                     onChange={(e) => {
                                       const val = e.target.value;
                                       setTempPrices(prev => ({ ...prev, [item.id]: val }));
                                       const parsed = parseFloat(val);
                                       if (!isNaN(parsed)) {
                                         handleUpdateItem(item.id, { price: parsed });
                                       }
                                     }}
                                     onBlur={() => {
                                       setTempPrices(prev => {
                                         const copy = { ...prev };
                                         delete copy[item.id];
                                         return copy;
                                        });
                                     }}
                                     className="w-full bg-transparent text-base font-bold text-slate-900 focus:outline-none tabular-nums min-w-0"
                                   />
                                 </div>
 
                                 <div className="flex-1 text-right min-w-0 px-1">
                                   <span className="text-[10px] font-black text-blue-600 block tabular-nums leading-none truncate text-right">
                                     ${(item.quantity * item.price).toLocaleString()}
                                   </span>
                                 </div>
 
                                 <button 
                                   onClick={() => handleRemoveItem(item.id)}
                                   className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-300 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"
                                 >
                                   <Trash2 className="w-3 h-3" />
                                 </button>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="favorites-tab"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute inset-0 overflow-y-auto px-2 sm:px-4 pt-3 pb-40 sm:pb-36 md:pb-28 custom-scrollbar"
                >
                  <div className="max-w-md mx-auto">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-4 px-1 text-center">
                       Favorites
                    </h4>
                     
                    {favorites.length === 0 ? (
                       <div className="p-20 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-slate-200 gap-4 mt-4 text-center">
                         <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                           <Star className="w-8 h-8 opacity-20" />
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">No favorites yet</p>
                         <p className="text-[8px] font-bold text-slate-300 leading-relaxed max-w-[150px]">Star products in search to save them here</p>
                       </div>
                    ) : (
                       <div className="grid grid-cols-1 gap-2">
                         {favorites.map((p, idx) => (
                           <div
                             key={idx}
                             className="w-full flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-500/30 transition-all group"
                           >
                             <div className="flex items-center gap-2 flex-1 truncate pr-2">
                               <button
                                 onClick={() => toggleFavorite(p)}
                                 className="p-1 rounded-md text-yellow-400 transition-colors"
                               >
                                 <Star className="w-3.5 h-3.5 fill-current" />
                               </button>
                               <div className="flex flex-col min-w-0 align-left text-left">
                                 <span className={`text-[11px] font-bold leading-snug truncate ${
                                   (!p.unlimitedStock && getRemainingStock(p) <= 0) ? 'text-slate-400' : 'text-slate-700'
                                 }`}>{p.name}</span>
                                 <span className={`text-[9px] font-semibold mt-0.5 ${
                                   (!p.unlimitedStock && getRemainingStock(p) <= 0) 
                                     ? 'text-red-500' 
                                     : getRemainingStock(p) < 10 && !p.unlimitedStock 
                                       ? 'text-amber-600' 
                                       : 'text-slate-400'
                                 }`}>
                                   {p.unlimitedStock ? '庫存: 無限制' : getRemainingStock(p) <= 0 ? '庫存: 已售罄' : `剩餘庫存: ${getRemainingStock(p)}`}
                                 </span>
                               </div>
                             </div>
                             <button
                               onClick={() => {
                                 if (!p.unlimitedStock && getRemainingStock(p) <= 0) { alert('該產品已無庫存！'); return; } handleAddProduct(p);
                                 setActiveTab('order');
                               }}
                               className={`p-1.5 rounded-lg active:scale-95 transition-all flex-shrink-0 text-white ${(!p.unlimitedStock && getRemainingStock(p) <= 0) ? "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none active:scale-100" : "bg-blue-600 shadow-lg shadow-blue-600/20"}`}
                             >
                               <Plus className="w-3 h-3" />
                             </button>
                           </div>
                         ))}
                       </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Floating Bottom Tab Switcher (Slide Bar) */}
          <div className="absolute bottom-24 md:bottom-12 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
            <div className="w-full max-w-[280px] bg-white/90 backdrop-blur-md border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/40 p-1 flex items-center relative pointer-events-auto">
              {/* Sliding highlight background */}
              <div className="absolute inset-y-1 left-1 bottom-1 top-1 pointer-events-none" style={{ width: 'calc(50% - 4px)' }}>
                <motion.div
                  layoutId="bottom-tab-highlight"
                  className="h-full bg-blue-600 rounded-xl shadow-md shadow-blue-600/10"
                  animate={{
                    translateX: activeTab === 'order' ? '0%' : '100%',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              </div>

              {/* Order Button */}
              <button
                type="button"
                onClick={() => setActiveTab('order')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider relative z-10 transition-colors duration-300 ${
                  activeTab === 'order' ? 'text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Order ({selectedItems.length})
              </button>

              {/* Favorites Button */}
              <button
                type="button"
                onClick={() => setActiveTab('favorites')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider relative z-10 transition-colors duration-300 ${
                  activeTab === 'favorites' ? 'text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                Favorites ({favorites.length})
              </button>
            </div>
          </div>
        </div>
        {renderModals()}
      </div>
    );
  }

  if (selectedRole) {
    return (
      <div className="min-h-screen w-full bg-white p-2 sm:p-6 animate-in fade-in slide-in-from-right-4 duration-500 overflow-x-hidden">
        <div className="w-full max-w-md mx-auto pt-4">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => setSelectedRole(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-black uppercase tracking-widest">Back to Roles</span>
            </button>
            <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
              ROLE: {selectedRole}
            </div>
          </div>

          <div className="relative mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋客戶名稱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner"
              />
            </div>
            <button
              onClick={() => {
                setNewCustomerDistrict(selectedDistrict || '九龍東');
                setNewCustomerGrade('C');
                setNewCustomerName('');
                setShowAddCustomerModal(true);
              }}
              className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex-shrink-0"
              title="Add New Customer"
            >
              <UserPlus className="w-5 h-5" />
            </button>
            {onShowOrderList && (
              <button 
                onClick={onShowOrderList}
                className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex-shrink-0"
                title="Order List"
              >
                <ListOrdered className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex gap-1 mb-4 overflow-x-auto pb-2 custom-scrollbar no-scrollbar scroll-smooth">
            {districts.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDistrict(selectedDistrict === d ? null : d)}
                className={`py-2 px-2 rounded-xl text-[9px] font-black transition-all whitespace-nowrap min-w-[70px] border ${
                  selectedDistrict === d 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 scale-[0.98]' 
                    : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                }`}
              >
                {d} ({districtCounts[d] || 0})
              </button>
            ))}
          </div>
          
          <div 
            onScroll={() => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }}
            onTouchMove={() => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }}
            className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-20"
          >
            {filteredCustomers.length === 0 ? (
              <div className="col-span-2 p-12 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                <ShoppingCart className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">沒有找到匹配的客戶</p>
              </div>
            ) : (
              filteredCustomers.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedCustomer(c.name)}
                  className="w-full flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-500/30 hover:bg-slate-50/50 transition-all duration-200 group active:scale-[0.98] text-left"
                >
                  <div className="overflow-hidden">
                    <p className="text-slate-900 font-bold text-[11px] leading-tight truncate">{c.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1 rounded ${
                        c.grade === 'A' ? 'bg-yellow-100 text-yellow-700' :
                        c.grade === 'B' ? 'bg-slate-100 text-slate-600' :
                        'bg-orange-100 text-orange-700'
                      }`}>Grade {c.grade}</span>
                      {selectedRole === 'Admin' && (
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Sales: {c.sales}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
        {renderModals()}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full" />
      
      <div className="relative z-10 w-full max-w-sm px-2 sm:px-0">
        <button 
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-400 transition-colors group mx-auto"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">返回主頁 / EXIT SYSTEM</span>
        </button>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-600/40 mb-6 rotate-3">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tighter mb-2">WHATS-ORDER</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Authentication Required</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {salesPeople.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className="group relative bg-white/5 hover:bg-blue-600 border border-white/5 hover:border-blue-500 p-6 rounded-3xl transition-all duration-300 flex flex-col items-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <User className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors relative z-10" />
                <span className="text-xs font-black text-slate-300 group-hover:text-white transition-colors relative z-10 uppercase tracking-widest">{role}</span>
              </button>
            ))}
            <button
              onClick={() => setSelectedRole('Admin')}
              className="col-span-2 group relative bg-slate-800/50 hover:bg-slate-700 border border-white/5 p-6 rounded-3xl transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden mt-2"
            >
              <ShieldCheck className="w-5 h-5 text-slate-500 group-hover:text-white" />
              <span className="text-xs font-black text-slate-400 group-hover:text-white uppercase tracking-widest">Admin Access</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderEntry;
