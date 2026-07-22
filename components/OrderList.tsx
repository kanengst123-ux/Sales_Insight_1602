import React, { useState, useRef, useCallback } from 'react';
import { SavedOrder } from '../types';
import { Calendar, User, DollarSign, MessageSquare, UserCircle, Plus, Trash2, Anchor, X, Users } from 'lucide-react';
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
}

const OrderList: React.FC<OrderListProps> = ({ 
  orders, 
  onEditOrder, 
  onDeleteOrder,
  onToggleHold,
  currentRole, 
  onNewOrder,
  onKeyInOrders,
  isKeyingIn = false
}) => {
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<SavedOrder | null>(null);

  const [showAll, setShowAll] = useState(currentRole === 'Admin' || !currentRole);

  const displayedOrders = (showAll || !currentRole)
    ? orders
    : orders.filter(o => o.salesName === currentRole);

  const keyInCount = orders.filter(
    o => (currentRole === 'Admin' || o.salesName === currentRole) && !o.isHeld && !o.isKeyedIn
  ).length;

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-6 sm:p-16 flex flex-col items-center text-center gap-6 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
          {currentRole ? <UserCircle className="w-12 h-12 text-slate-300" /> : <Calendar className="w-12 h-12 text-slate-300" />}
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-800">
            {currentRole === 'Admin' ? '所有用戶的訂單' : (currentRole ? `${currentRole} 的訂單` : '暫無訂單記錄')}
          </h3>
          <p className="text-slate-500 mt-2 max-w-md font-medium">
            {currentRole === 'Admin'
              ? '目前所有用戶都沒有儲存任何訂單記錄。'
              : (currentRole 
                  ? `目前在此賬號下沒有訂單記錄。在「落單」頁面完成訂單後會顯示在此處。`
                  : '您還沒有儲存任何訂單。在「落單」頁面完成訂單後會顯示在此處。')}
          </p>
        </div>
        {currentRole && (
          <button 
            onClick={onNewOrder}
            className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            開始新訂單
          </button>
        )}
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="relative">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="px-4 sm:px-8 py-4 bg-slate-50/30 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {showAll ? '目前顯示所有用戶的訂單' : `目前顯示 ${currentRole} 的訂單`}
              </span>
            </div>
            {currentRole && currentRole !== 'Admin' && (
              <div className="inline-flex p-1 bg-slate-100 border border-slate-200/80 rounded-full text-[10px] font-bold shadow-inner">
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 ${
                    !showAll
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  只看自己
                </button>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 ${
                    showAll
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  顯示所有用戶
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{displayedOrders.length} 份訂單</span>
            {onKeyInOrders && (
              <button
                disabled={isKeyingIn || keyInCount === 0}
                onClick={async (e) => {
                  e.stopPropagation();
                  setStatusMessage(null);
                  const success = await onKeyInOrders();
                  if (success) {
                    setStatusMessage({
                      text: "🎉 入機成功！數量已成功在 Google 表格「raw」工作表的 Col AC（Stock）中更新。",
                      type: 'success'
                    });
                    setTimeout(() => setStatusMessage(null), 8000);
                  } else {
                    setStatusMessage({
                      text: "❌ 入機失敗，請確認您的網絡連接，或稍後再試。",
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
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] active:scale-95'
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
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`px-4 sm:px-8 py-3.5 text-xs font-bold border-b flex items-center justify-between gap-4 overflow-hidden
                ${statusMessage.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold leading-relaxed">{statusMessage.text}</span>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-1 py-6 font-bold text-slate-500 uppercase tracking-widest text-[9px] w-px text-center">Date</th>
              <th className="px-2 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px] w-full">Customer Name</th>
              <th className="px-2 py-6 font-bold text-slate-500 uppercase tracking-widest text-[9px] w-px">Order Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayedOrders.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-16 text-center text-slate-400 font-medium">
                  <div className="flex flex-col items-center gap-3">
                    <UserCircle className="w-10 h-10 text-slate-300" />
                    <div>
                      <p className="text-slate-700 font-bold">您目前沒有任何訂單記錄</p>
                      <p className="text-xs text-slate-400 mt-1">您可以點擊上方的「顯示所有用戶」查看其他人的訂單。</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              displayedOrders.map((order) => (
                <React.Fragment key={order.id}>
                    <tr 
                      onClick={() => onEditOrder(order)}
                      className={`transition-colors group cursor-pointer ${order.isHeld ? 'bg-amber-50/70' : 'hover:bg-blue-50/30'}`}
                    >
                    <td className="px-1 py-4 text-slate-500 font-bold whitespace-nowrap text-center text-[11px] align-top pt-4">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        {formatDate(order.date)}
                      </div>
                    </td>
                    <td className="px-2 py-4 text-slate-900 font-black align-top pt-3.5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{order.customerName}</span>
                          {order.id && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-slate-100 text-slate-600 border border-slate-200 font-mono font-bold tracking-wider tabular-nums shrink-0 leading-none">
                              {order.id}
                            </span>
                          )}
                          {(currentRole === 'Admin' || showAll) && order.salesName && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-blue-50 text-blue-600 border border-blue-200 font-bold uppercase tracking-wider shrink-0 leading-none">
                              Sales: {order.salesName}
                            </span>
                          )}
                          {order.isHeld && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold uppercase tracking-wider tabular-nums shrink-0 leading-none">
                              暫存
                            </span>
                          )}
                          {order.isKeyedIn && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold uppercase tracking-wider tabular-nums shrink-0 leading-none">
                              已入機
                            </span>
                          )}
                        </div>

                        {/* Tiny buttons under the customer name */}
                        <div className="flex items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
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
                    <td className="px-2 py-4 text-right text-slate-900 font-black tabular-nums text-sm align-top pt-4">
                      <div className="flex items-center justify-end gap-1 text-emerald-600">
                        <DollarSign className="w-3.5 h-3.5" />
                        {order.orderAmount.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                  {order.remark && (
                    <tr 
                      onClick={() => onEditOrder(order)}
                      className="border-t-0 bg-slate-50/30 hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td />
                      <td colSpan={2} className="px-2 py-3 pb-5">
                        <div className="flex items-start gap-2 text-slate-500 text-[11px] font-medium leading-relaxed bg-white/50 p-3 rounded-xl border border-slate-100/50">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-300 mt-0.5 shrink-0" />
                          <span className="italic">{order.remark}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

      {currentRole && (
        <button 
          onClick={onNewOrder}
          className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-[60] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group flex items-center gap-2"
          title="New Order"
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
                確定要刪除「<span className="font-bold text-slate-900">{orderToDelete.customerName}</span>」金額為 <span className="font-bold text-emerald-600">${orderToDelete.orderAmount.toLocaleString()}</span> 的訂單嗎？此操作無法復原。
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrderToDelete(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteOrder(orderToDelete.id);
                    setOrderToDelete(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-colors"
                >
                  確認刪除
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
