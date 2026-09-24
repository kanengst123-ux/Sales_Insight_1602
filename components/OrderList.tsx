import React, { useState, useMemo } from 'react';
import { SavedOrder } from '../types';
import { 
  Calendar, 
  User, 
  DollarSign, 
  MessageSquare, 
  UserCircle, 
  Plus, 
  Trash2, 
  Anchor, 
  X, 
  Users, 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Package, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderListProps {
  orders: SavedOrder[];
  onEditOrder: (order: SavedOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onToggleHold: (orderId: string) => void;
  currentRole: string | null;
  onNewOrder: () => void;
  onKeyInOrders?: () => Promise<boolean>;
  isKeyingIn?: boolean;
  onRefreshOrders?: () => Promise<void> | void;
}

const PAGE_SIZE = 50;

const OrderList: React.FC<OrderListProps> = ({ 
  orders, 
  onEditOrder, 
  onDeleteOrder, 
  onToggleHold, 
  currentRole, 
  onNewOrder, 
  onKeyInOrders, 
  isKeyingIn = false,
  onRefreshOrders
}) => {
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<SavedOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'KEYED_IN' | 'HELD'>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [showAll, setShowAll] = useState(currentRole === 'Admin' || !currentRole);

  // Extract unique sales names from orders
  const uniqueSalesReps = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.salesName && o.salesName.trim()) {
        set.add(o.salesName.trim());
      }
    });
    return Array.from(set).sort();
  }, [orders]);

  // Handle manual refresh
  const handleRefresh = async () => {
    if (!onRefreshOrders || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshOrders();
      setStatusMessage({ text: '訂單記錄已成功同步更新！', type: 'success' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      setStatusMessage({ text: '同步失敗，請檢查網絡連接。', type: 'error' });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Base role-filtered orders
  const roleFilteredOrders = useMemo(() => {
    if (!currentRole || currentRole.trim().toUpperCase() === 'ADMIN' || showAll) {
      return orders;
    }
    const targetRole = currentRole.trim().toUpperCase();
    return orders.filter(o => (o.salesName || '').trim().toUpperCase() === targetRole);
  }, [orders, currentRole, showAll]);

  // Counts for tabs
  const counts = useMemo(() => {
    let pending = 0;
    let keyedIn = 0;
    let held = 0;
    roleFilteredOrders.forEach(o => {
      if (o.isHeld) held++;
      else if (o.isKeyedIn) keyedIn++;
      else pending++;
    });
    return { total: roleFilteredOrders.length, pending, keyedIn, held };
  }, [roleFilteredOrders]);

  // Detailed filtering by user, status, and search query
  const filteredOrders = useMemo(() => {
    return roleFilteredOrders.filter(order => {
      // User filter
      if (selectedUser !== 'ALL' && (order.salesName || '').trim().toUpperCase() !== selectedUser.trim().toUpperCase()) {
        return false;
      }

      // Status filter
      if (statusFilter === 'PENDING' && (order.isKeyedIn || order.isHeld)) return false;
      if (statusFilter === 'KEYED_IN' && !order.isKeyedIn) return false;
      if (statusFilter === 'HELD' && !order.isHeld) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCust = (order.customerName || '').toLowerCase().includes(q);
        const matchesId = (order.id || '').toLowerCase().includes(q);
        const matchesSales = (order.salesName || '').toLowerCase().includes(q);
        const matchesRemark = (order.remark || '').toLowerCase().includes(q);
        const matchesItem = order.items?.some(it => (it.name || '').toLowerCase().includes(q));
        if (!matchesCust && !matchesId && !matchesSales && !matchesRemark && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [roleFilteredOrders, selectedUser, statusFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  const keyInCount = orders.filter(
    o => (!currentRole || currentRole.trim().toUpperCase() === 'ADMIN' || (o.salesName || '').trim().toUpperCase() === currentRole.trim().toUpperCase()) && !o.isHeld && !o.isKeyedIn
  ).length;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr.split(' ')[0] || dateStr;
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return dateStr;
    }
  };

  const toggleExpand = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  return (
    <div className="relative space-y-4 pb-20 sm:pb-8 w-full">
      {/* Top Banner / Controls Card */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="px-4 sm:px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Header Title & Role Indicators */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">
                {currentRole === 'Admin' ? '所有用戶的訂單中心 (Admin 全覽)' : (showAll ? '全部用戶的訂單記錄' : `${currentRole} 的個人訂單`)}
              </h3>
            </div>

            {currentRole && currentRole !== 'Admin' && (
              <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-bold shadow-inner">
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all duration-200 ${
                    !showAll
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3 h-3" />
                  只看自己
                </button>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all duration-200 ${
                    showAll
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  全部用戶
                </button>
              </div>
            )}
          </div>

          {/* Action buttons: Refresh, New Order, Key-in */}
          <div className="flex items-center gap-2 flex-wrap">
            {onRefreshOrders && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="重新整理訂單資料"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-bold text-xs transition-all flex items-center gap-1 border border-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                <span className="hidden sm:inline">刷新</span>
              </button>
            )}

            {currentRole && (
              <button
                type="button"
                onClick={onNewOrder}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm flex items-center gap-1 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>落單</span>
              </button>
            )}

            {onKeyInOrders && (
              <button
                disabled={isKeyingIn || keyInCount === 0}
                onClick={async (e) => {
                  e.stopPropagation();
                  setStatusMessage(null);
                  const success = await onKeyInOrders();
                  if (success) {
                    setStatusMessage({
                      text: "🎉 入機成功！數量已在 Google 表格中記錄並扣減庫存。",
                      type: 'success'
                    });
                    setTimeout(() => setStatusMessage(null), 8000);
                  } else {
                    setStatusMessage({
                      text: "❌ 入機失敗，請確認網絡連接後重試。",
                      type: 'error'
                    });
                    setTimeout(() => setStatusMessage(null), 8000);
                  }
                }}
                className={`px-4 py-1.5 rounded-xl font-bold text-xs select-none shadow-sm transition-all focus:outline-none flex items-center gap-1.5
                  ${keyInCount === 0 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                    : isKeyingIn 
                      ? 'bg-blue-100 text-blue-500 cursor-wait'
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] active:scale-95 shadow-md shadow-blue-600/20'
                  }`}
              >
                {isKeyingIn ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-current rounded-full animate-spin" />
                    入機中...
                  </>
                ) : (
                  <>
                    入機 ({keyInCount})
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Filter bar: Search, Status, & Sales Rep */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col gap-3">
          {/* Search box & Status pills */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="搜尋客戶名、訂單編號、貨品或備註..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                全部 ({counts.total})
              </button>

              <button
                type="button"
                onClick={() => { setStatusFilter('PENDING'); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === 'PENDING'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                <Clock className="w-3 h-3" />
                未入機 ({counts.pending})
              </button>

              <button
                type="button"
                onClick={() => { setStatusFilter('KEYED_IN'); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === 'KEYED_IN'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                已入機 ({counts.keyedIn})
              </button>

              <button
                type="button"
                onClick={() => { setStatusFilter('HELD'); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === 'HELD'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <Anchor className="w-3 h-3" />
                暫存 ({counts.held})
              </button>
            </div>
          </div>

          {/* Sales Rep Selector (Especially for Admin or when viewing All) */}
          {(currentRole === 'Admin' || showAll) && uniqueSalesReps.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none border-t border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 whitespace-nowrap mr-1">
                業務代表:
              </span>
              <button
                type="button"
                onClick={() => { setSelectedUser('ALL'); setCurrentPage(1); }}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${
                  selectedUser === 'ALL'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                全部 Sales
              </button>
              {uniqueSalesReps.map(rep => (
                <button
                  key={rep}
                  type="button"
                  onClick={() => { setSelectedUser(rep); setCurrentPage(1); }}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${
                    selectedUser === rep
                      ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {rep}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Message Notification */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`px-4 sm:px-6 py-3 text-xs font-bold border-b flex items-center justify-between gap-4 overflow-hidden
                ${statusMessage.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                }`}
            >
              <div className="flex items-center gap-2">
                <span className="leading-relaxed">{statusMessage.text}</span>
              </div>
              <button 
                onClick={() => setStatusMessage(null)}
                className="p-1 hover:bg-slate-500/10 text-slate-400 hover:text-slate-600 rounded-lg transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orders Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-2 py-3 font-bold text-slate-500 uppercase tracking-widest text-[9px] w-12 text-center">日期</th>
                <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px] w-full">客戶名稱 / 訂單資訊</th>
                <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-right whitespace-nowrap">金額</th>
                <th className="px-2 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px] w-10 text-center">詳情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center gap-3">
                      <UserCircle className="w-10 h-10 text-slate-300" />
                      <div>
                        <p className="text-slate-700 font-bold">沒有符合條件的訂單記錄</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {searchQuery ? '請嘗試清除搜尋關鍵字，或切換狀態篩選條件。' : '當有其他用戶落單或入機後，會自動在此處更新顯示。'}
                        </p>
                      </div>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                        >
                          清除搜尋關鍵字
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <React.Fragment key={order.id}>
                      <tr 
                        onClick={() => onEditOrder(order)}
                        className={`transition-colors group cursor-pointer ${
                          order.isHeld 
                            ? 'bg-amber-50/60 hover:bg-amber-100/60' 
                            : isExpanded 
                              ? 'bg-blue-50/40' 
                              : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Date */}
                        <td className="px-2 py-3 text-slate-500 font-bold whitespace-nowrap text-center text-[11px] align-top pt-3.5">
                          <div className="flex flex-col items-center justify-center">
                            <Calendar className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors mb-0.5" />
                            <span>{formatDate(order.date)}</span>
                          </div>
                        </td>

                        {/* Customer, ID, Sales badge, Status badges, and Action Buttons */}
                        <td className="px-3 py-3 text-slate-900 font-black align-top">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="text-sm font-black text-slate-900 leading-tight hover:text-blue-600 transition-colors">
                                {order.customerName}
                              </span>

                              {/* Order ID */}
                              {order.id && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-slate-100 text-slate-600 border border-slate-200 font-mono font-bold tracking-wider tabular-nums shrink-0 leading-none">
                                  {order.id}
                                </span>
                              )}

                              {/* Sales Rep Badge */}
                              {order.salesName && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] bg-blue-50 text-blue-700 border border-blue-200 font-black tracking-wide shrink-0 leading-none">
                                  Sales: {order.salesName}
                                </span>
                              )}

                              {/* Status Badges */}
                              {order.isHeld && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-amber-500/15 text-amber-700 border border-amber-500/30 font-bold uppercase tracking-wider tabular-nums shrink-0 leading-none">
                                  暫存
                                </span>
                              )}
                              {order.isKeyedIn ? (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-bold uppercase tracking-wider tabular-nums shrink-0 leading-none flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  已入機
                                </span>
                              ) : !order.isHeld && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-sky-500/15 text-sky-700 border border-sky-500/30 font-bold uppercase tracking-wider tabular-nums shrink-0 leading-none flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  未入機
                                </span>
                              )}
                            </div>

                            {/* Item count & Sub-buttons */}
                            <div className="flex items-center gap-2 flex-wrap pt-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[11px] text-slate-400 font-medium">
                                共 {order.items?.length || 0} 種貨品
                              </span>

                              <span className="text-slate-300">•</span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleHold(order.id);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all active:scale-95 border ${
                                  order.isHeld
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-800'
                                }`}
                              >
                                <Anchor className="w-2.5 h-2.5" />
                                <span>{order.isHeld ? '取消暫存' : '暫存'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOrderToDelete(order);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all active:scale-95 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 hover:text-rose-700"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                                <span>刪除</span>
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Order Amount */}
                        <td className="px-3 py-3 text-right text-slate-900 font-black tabular-nums text-sm align-top pt-3.5 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-0.5 text-emerald-600">
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{Math.round(order.orderAmount).toLocaleString()}</span>
                          </div>
                        </td>

                        {/* Expand / Collapse Button */}
                        <td className="px-2 py-3 text-center align-top pt-3.5" onClick={(e) => toggleExpand(order.id, e)}>
                          <button
                            type="button"
                            className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                            title={isExpanded ? '收起詳情' : '展開貨品清單'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Remark line */}
                      {order.remark && !isExpanded && (
                        <tr 
                          onClick={() => onEditOrder(order)}
                          className="border-t-0 bg-slate-50/30 hover:bg-blue-50/40 cursor-pointer transition-colors"
                        >
                          <td />
                          <td colSpan={3} className="px-3 py-1.5 pb-3">
                            <div className="flex items-start gap-1.5 text-slate-500 text-[11px] font-medium leading-relaxed bg-white/60 px-2.5 py-1.5 rounded-lg border border-slate-100">
                              <MessageSquare className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                              <span className="italic">{order.remark}</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expanded Line Items Detail */}
                      {isExpanded && (
                        <tr className="bg-blue-50/20 border-t border-b border-blue-100">
                          <td />
                          <td colSpan={3} className="px-3 py-3 pb-4">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 border-b border-slate-100 pb-1.5">
                                <span className="flex items-center gap-1 text-slate-700">
                                  <Package className="w-3.5 h-3.5 text-blue-500" />
                                  訂單包含貨品清單 ({order.items?.length || 0})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onEditOrder(order)}
                                  className="text-blue-600 hover:underline text-[10px] font-bold"
                                >
                                  編輯此訂單 &rarr;
                                </button>
                              </div>

                              <div className="divide-y divide-slate-50">
                                {order.items?.map((item, itmIdx) => (
                                  <div key={itmIdx} className="py-1.5 flex items-center justify-between text-xs gap-3">
                                    <div className="flex-1 truncate">
                                      <span className="font-bold text-slate-800">{item.name}</span>
                                      {item.isOuterBox && (
                                        <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                          {item.outerBoxUnit || '箱'}裝 ({item.unitsPerBox || 1})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right text-slate-500 tabular-nums shrink-0 text-[11px]">
                                      <span>${item.price} &times; </span>
                                      <span className="font-bold text-slate-900">{item.quantity}</span>
                                      <span className="ml-2 font-black text-slate-900">
                                        = ${Math.round(item.price * item.quantity).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {order.remark && (
                                <div className="pt-2 border-t border-slate-100 flex items-start gap-1.5 text-slate-600 text-xs">
                                  <MessageSquare className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                                  <span className="font-medium italic">備註: {order.remark}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
            <div>
              顯示第 {(currentPage - 1) * PAGE_SIZE + 1} 至 {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} 筆（共 {filteredOrders.length} 筆）
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                上一頁
              </button>
              <span className="px-2 text-slate-400">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button for New Order */}
      {currentRole && (
        <button 
          onClick={onNewOrder}
          className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-[60] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group flex items-center gap-2"
          title="落單"
        >
          <Plus className="w-6 h-6 shrink-0" />
          <span className="font-black text-xs uppercase tracking-widest whitespace-nowrap hidden md:block">落單</span>
        </button>
      )}

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {orderToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-xs overflow-hidden z-10 border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">確認刪除訂單？</h4>
                  <p className="text-xs font-bold text-slate-400">{orderToDelete.customerName}</p>
                </div>
              </div>
              
              <p className="text-xs text-slate-600 mb-6 font-medium leading-relaxed">
                確定要刪除「<span className="font-bold text-slate-900">{orderToDelete.customerName}</span>」金額為 <span className="font-bold text-emerald-600">${Math.round(orderToDelete.orderAmount).toLocaleString()}</span> 的訂單嗎？
                {orderToDelete.isKeyedIn && '（此操作會同時在伺服器及 Google 表格中刪除並回補庫存）'}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setOrderToDelete(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    if (isDeleting) return;
                    setIsDeleting(true);
                    try {
                      await onDeleteOrder(orderToDelete.id);
                    } finally {
                      setIsDeleting(false);
                      setOrderToDelete(null);
                    }
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? '刪除中...' : '確認刪除'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderList;
