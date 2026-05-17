
import React, { useState, useEffect, useMemo } from 'react';
import { User, ShieldCheck, ArrowLeft, ShoppingCart, ChevronRight, Search, Loader2, Plus, Minus, Trash2, Package, Box, Check, Star, ListOrdered } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchCustomerGrades, fetchProducts } from '../services/dataService';
import { Product, OrderItem, Customer, SavedOrder } from '../types';

interface OrderEntryProps {
  onBack: () => void;
  onSaveOrder?: (order: SavedOrder) => void;
  onShowOrderList?: () => void;
  editingOrder?: SavedOrder | null;
}

const OrderEntry: React.FC<OrderEntryProps> = ({ onBack, onSaveOrder, onShowOrderList, editingOrder }) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(() => {
    if (editingOrder?.salesName) return editingOrder.salesName;
    return localStorage.getItem('ws_selected_role');
  });
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(editingOrder?.customerName || null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>(editingOrder?.items || []);
  const [remark, setRemark] = useState(editingOrder?.remark || '');
  const [showRemarkInput, setShowRemarkInput] = useState(!!editingOrder?.remark);
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const salesPeople = ['EVA', 'KATIE', 'YO', 'KASEY'];
  const districts = ['新界東', '新界西', '九龍東', '九龍西', '港島'];

  const districtCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    districts.forEach(d => counts[d] = 0);
    
    customers.forEach(c => {
      const isVisible = selectedRole === 'Admin' 
        ? c.name === '落鋪'
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
      setLoading(true);
      const [customerData, productData] = await Promise.all([
        fetchCustomerGrades(),
        fetchProducts()
      ]);
      setCustomers(customerData);
      setProducts(productData);
      
      setLoading(false);
    };
    loadData();
  }, []);

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
      // Regex to find number/unitName
      // Example: "6/箱" -> 6 and "箱", "10/條" -> 10 and "條"
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

  const handleAddProduct = (product: Product) => {
    const boxInfo = parseOuterBoxInfo(product.name);
    // Determine price based on selected customer's grade
    const grade = selectedCustomerInfo?.grade || 'C';
    const tieredPrice = product.prices ? product.prices[grade] : (product.price || 0);

    const newItem: OrderItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: product.name,
      // Default to 1 outer (either parsed or fallback 12) per user request
      quantity: boxInfo ? boxInfo.units : 12,
      price: tieredPrice,
      isOuterBox: true, // Start in outer mode
      unitsPerBox: boxInfo ? boxInfo.units : 12,
      outerBoxUnit: boxInfo ? boxInfo.unitName : "打"
    };
    setSelectedItems(prev => [newItem, ...prev]);
    setProductSearchQuery(''); // Clear search after adding
  };

  const handleUpdateItem = (id: string, updates: Partial<OrderItem>) => {
    setSelectedItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
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
    
    const order: SavedOrder = {
      id: editingOrder?.id || `${Date.now()}`,
      date: editingOrder?.date || new Date().toISOString(),
      customerName: selectedCustomer,
      orderAmount: totalAmount,
      salesName: selectedRole || 'Unknown',
      remark: remark,
      items: selectedItems
    };
    
    onSaveOrder?.(order);
    // Reset state
    setSelectedItems([]);
    setRemark('');
    setSelectedCustomer(null);
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
      baseList = customers.filter(c => c.name === '落鋪');
    } else {
      baseList = customers.filter(c => c.sales.toUpperCase() === selectedRole.toUpperCase());
    }

    if (selectedDistrict) {
      baseList = baseList.filter(c => c.district === selectedDistrict);
    }

    if (!searchQuery.trim()) return baseList;

    const query = searchQuery.toLowerCase();
    return baseList.filter(c => 
      c.name.toLowerCase().includes(query) || 
      (selectedRole === 'Admin' && c.sales.toLowerCase().includes(query))
    );
  }, [customers, selectedRole, searchQuery, selectedDistrict]);

  const selectedCustomerInfo = useMemo(() => {
    return customers.find(c => c.name === selectedCustomer);
  }, [customers, selectedCustomer]);

  if (selectedCustomer) {
    return (
      <div className="min-h-screen bg-white animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col">
        {/* Top Layer: Product Search Box */}
        <div className="sticky top-0 z-[55] bg-white/80 backdrop-blur-md px-4 py-2 border-b border-slate-50">
          <div className="max-w-md mx-auto relative flex items-center gap-2">
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
                placeholder="搜尋產品 (Col C)..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300 shadow-inner"
              />
            </div>
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
                onScroll={() => searchInputRef.current?.blur()}
                className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-[50vh] overflow-y-auto custom-scrollbar ring-8 ring-black/5"
              >
                {loading ? (
                  <div className="p-4 text-center text-slate-300">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Searching...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                    找不到產品
                  </div>
                ) : (
                  filteredProducts.map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleAddProduct(p)}
                      className="w-full flex items-center justify-between p-3 hover:bg-blue-50 border-b border-slate-50 last:border-none transition-colors group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1 truncate pr-2">
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
                        <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-700 leading-snug truncate">{p.name}</span>
                      </div>
                      <div className="bg-slate-100 p-1 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <Plus className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content: Selected Products or Favorites */}
        <div className="flex-1 overflow-hidden bg-slate-50/30 flex flex-col relative">
          {/* Tab Switcher Labels (Optional visual aid) */}
          <div className="flex px-4 pt-2 gap-4">
            <button 
              onClick={() => setActiveTab('order')}
              className={`text-[9px] font-black uppercase tracking-[0.2em] pb-1 transition-colors relative ${
                activeTab === 'order' ? 'text-blue-600' : 'text-slate-300'
              }`}
            >
              Order
              {activeTab === 'order' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('favorites')}
              className={`text-[9px] font-black uppercase tracking-[0.2em] pb-1 transition-colors relative ${
                activeTab === 'favorites' ? 'text-blue-600' : 'text-slate-300'
              }`}
            >
              Favorites
              {activeTab === 'favorites' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'order' ? (
                <motion.div
                  key="order-tab"
                  initial={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute inset-0 overflow-y-auto px-4 py-3 custom-scrollbar"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -50) setActiveTab('favorites');
                  }}
                >
                  <div className="max-w-md mx-auto">
                    {/* Selected Products List */}
                    <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex flex-col flex-1 pr-2 min-w-0">
                          <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 truncate">
                            <span className="truncate">{selectedCustomer}</span> 
                            <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">Grade {selectedCustomerInfo?.grade}</span>
                            <span className="flex items-center justify-center min-w-[16px] h-4 bg-slate-200 text-slate-600 text-[8px] rounded-full px-1 flex-shrink-0">{selectedItems.length}</span>
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <button 
                              onClick={() => setShowRemarkInput(!showRemarkInput)}
                              className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest transition-colors ${remark ? 'text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}
                            >
                              <Check className={`w-3 h-3 ${remark ? 'block' : 'hidden'}`} />
                              {remark ? '已添加備註' : '+ 備註'}
                            </button>
                            {remark && (
                              <button onClick={() => setRemark('')} className="text-[8px] text-red-400 hover:text-red-600">Clear</button>
                            )}
                          </div>
                        </div>
                        {selectedItems.length > 0 && (
                          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                            <button 
                              onClick={() => setSelectedItems([])}
                              className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors px-1"
                            >
                              CLEAR ALL
                            </button>
                            <button 
                              onClick={handleFinalSave}
                              className="bg-green-500 hover:bg-green-600 text-white p-2.5 rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all group shrink-0"
                              title="Place Order"
                            >
                              <Check className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        )}
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
                            className="w-full bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[60px]"
                          />
                        </motion.div>
                      )}

                      {selectedItems.length === 0 ? (
                        <div className="p-20 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-slate-200 gap-4 mt-4">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                            <Package className="w-8 h-8 opacity-20" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">No items selected</p>
                          <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Swipe left for Favorites ←</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedItems.map((item) => (
                            <div key={item.id} className="bg-white border border-slate-100 rounded-xl p-2 shadow-sm hover:shadow-md transition-all group">
                              {/* Row 1: Name and Toggle */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 flex-1 truncate">
                                  <button
                                    onClick={() => {
                                      const prod = products.find(p => p.name === item.name);
                                      if (prod) toggleFavorite(prod);
                                    }}
                                    className={`p-1 rounded-md transition-colors ${
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
                                      onClick={() => {
                                        if (item.isOuterBox) {
                                          handleUpdateItem(item.id, { isOuterBox: false, quantity: 1 });
                                        }
                                      }}
                                      className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
                                        !item.isOuterBox 
                                          ? 'bg-white text-blue-600 shadow-sm' 
                                          : 'text-slate-400 hover:text-slate-600'
                                      }`}
                                    >
                                      單位
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (!item.isOuterBox) {
                                          handleUpdateItem(item.id, { isOuterBox: true, quantity: item.unitsPerBox || 12 });
                                        }
                                      }}
                                      className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
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

                              {/* Row 2: Quantity, Price, Trash */}
                              <div className="flex items-center gap-1.5">
                                {/* Quantity */}
                                <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden min-w-[80px]">
                                  <button 
                                    onClick={() => {
                                      const step = (item.isOuterBox && item.outerBoxUnit !== '打') ? (item.unitsPerBox || 1) : 1;
                                      handleUpdateItem(item.id, { quantity: Math.max(0, item.quantity - step) });
                                    }}
                                    className="px-1.5 py-1 text-slate-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                    className="w-full text-center bg-transparent text-[10px] font-bold text-slate-900 focus:outline-none tabular-nums"
                                  />
                                  <button 
                                    onClick={() => {
                                      const step = (item.isOuterBox && item.outerBoxUnit !== '打') ? (item.unitsPerBox || 1) : 1;
                                      handleUpdateItem(item.id, { quantity: item.quantity + step });
                                    }}
                                    className="px-1.5 py-1 text-slate-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>

                                {/* Price */}
                                <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-1.5 py-1 w-14">
                                  <span className="text-slate-400 text-[8px] font-bold mr-0.5">$</span>
                                  <input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => handleUpdateItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-transparent text-[10px] font-bold text-slate-900 focus:outline-none tabular-nums"
                                  />
                                </div>

                                {/* Subtotal */}
                                <div className="flex-1 text-right min-w-0 pr-1">
                                  <span className="text-[11px] font-black text-blue-600 block tabular-nums leading-none truncate">
                                    ${(item.quantity * item.price).toLocaleString()}
                                  </span>
                                </div>

                                {/* Trash */}
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
                  className="absolute inset-0 overflow-y-auto px-4 py-3 custom-scrollbar"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 50) setActiveTab('order');
                  }}
                >
                  <div className="max-w-md mx-auto">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-4 px-1">
                      Favorites <span className="text-slate-300 ml-2">Swipe right for Order →</span>
                    </h4>
                    
                    {favorites.length === 0 ? (
                      <div className="p-20 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-slate-200 gap-4 mt-4 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                          <Star className="w-8 h-8 opacity-20" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">No favorites yet</p>
                        <p className="text-[8px] font-bold text-slate-300 leading-relaxed max-w-[150px]">Star products in search or order to save them here</p>
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
                              <span className="text-[11px] font-bold text-slate-700 leading-snug truncate">{p.name}</span>
                            </div>
                            <button
                              onClick={() => {
                                handleAddProduct(p);
                                setActiveTab('order');
                              }}
                              className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
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
        </div>

      </div>
    );
  }

  if (selectedRole) {
    return (
      <div className="min-h-screen bg-white p-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="max-w-md mx-auto pt-4">
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

          {/* Search Bar */}
          <div className="relative mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋客戶名稱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner"
              />
            </div>
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

          {/* District Quick Filter - Row */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-2 custom-scrollbar no-scrollbar scroll-smooth">
            {districts.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDistrict(selectedDistrict === d ? null : d)}
                className={`py-2 px-2 rounded-xl text-[9px] font-black transition-all whitespace-nowrap flex-1 border ${
                  selectedDistrict === d 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 scale-[0.98]' 
                    : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                }`}
              >
                {d} ({districtCounts[d] || 0})
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="col-span-2 flex flex-col items-center justify-center p-20 text-slate-300">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Fetching Customer List...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="col-span-2 p-12 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                <ShoppingCart className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">沒有找到匹配的客戶</p>
              </div>
            ) : (
              filteredCustomers.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedCustomer(c.name)}
                  className="w-full flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-500/30 hover:bg-slate-50/50 transition-all duration-200 group active:scale-[0.98]"
                >
                  <div className="text-left overflow-hidden">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full" />
      
      <div className="relative z-10 w-full max-w-sm">
        <button 
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-400 transition-colors group mx-auto"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">返回主頁 / EXIT SYSTEM</span>
        </button>

        <div className="mb-8 text-center">
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">
            落單系統 <span className="text-blue-500">.</span>
          </h2>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">Select Role to Continue</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {salesPeople.map((person) => (
            <button
              key={person}
              onClick={() => setSelectedRole(person)}
              className="group bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-5 rounded-[2rem] transition-all duration-300 hover:bg-slate-900/60 active:scale-[0.98] flex flex-col items-center gap-3 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors relative z-10">
                <User className="w-6 h-6" />
              </div>
              <span className="text-sm font-black text-slate-200 group-hover:text-white transition-colors uppercase tracking-widest relative z-10">{person}</span>
            </button>
          ))}
          
          <button
            onClick={() => setSelectedRole('Admin')}
            className="group col-span-2 bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-[2rem] transition-all duration-300 hover:bg-slate-900/60 active:scale-[0.98] flex items-center justify-center gap-4 text-slate-200 mt-2 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors relative z-10">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-sm font-black uppercase tracking-[0.2em] group-hover:text-white transition-colors relative z-10">ADMIN LOGIN</span>
          </button>
        </div>
        
        <p className="mt-10 text-center text-[9px] font-bold text-slate-700 uppercase tracking-[0.25em]">
          WS SALES SYSTEM v1.0
        </p>
      </div>
    </div>
  );
};

export default OrderEntry;
