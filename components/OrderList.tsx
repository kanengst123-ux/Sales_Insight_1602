import React, { useState, useRef, useCallback } from 'react';
import { SavedOrder } from '../types';
import { Calendar, User, DollarSign, MessageSquare, UserCircle, Plus, Trash2, Anchor, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderListProps {
  orders: SavedOrder[];
  onEditOrder: (order: SavedOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onToggleHold: (orderId: string) => void;
  currentRole: string | null;
  onNewOrder: () => void;
}

const OrderList: React.FC<OrderListProps> = ({ 
  orders, 
  onEditOrder, 
  onDeleteOrder,
  onToggleHold,
  currentRole, 
  onNewOrder 
}) => {
  const [activeMenuOrder, setActiveMenuOrder] = useState<SavedOrder | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = useCallback((order: SavedOrder) => {
    longPressTimer.current = setTimeout(() => {
      setActiveMenuOrder(order);
    }, 600); // 600ms for long press
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-6 sm:p-16 flex flex-col items-center text-center gap-6 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
          {currentRole ? <UserCircle className="w-12 h-12 text-slate-300" /> : <Calendar className="w-12 h-12 text-slate-300" />}
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-800">
            {currentRole ? `${currentRole} 的訂單` : '暫無訂單記錄'}
          </h3>
          <p className="text-slate-500 mt-2 max-w-md font-medium">
            {currentRole 
              ? `目前在此賬號下沒有訂單記錄。在「落單」頁面完成訂單後會顯示在此處。`
              : '您還沒有儲存任何訂單。在「落單」頁面完成訂單後會顯示在此處。'}
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
        <div className="px-4 sm:px-8 py-4 bg-slate-50/30 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">目前顯示 {currentRole} 的訂單</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{orders.length} 份訂單</div>
        </div>
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
            {orders.map((order) => (
              <React.Fragment key={order.id}>
                  <tr 
                    onMouseDown={() => startLongPress(order)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onTouchStart={() => startLongPress(order)}
                    onTouchEnd={cancelLongPress}
                    onClick={() => {
                      if (!activeMenuOrder) {
                        onEditOrder(order);
                      }
                    }}
                    className={`transition-colors group cursor-pointer ${order.isHeld ? 'bg-amber-50 h-20' : 'hover:bg-blue-50/30'}`}
                  >
                  <td className="px-1 py-5 text-slate-500 font-bold whitespace-nowrap text-center text-[11px]">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      {formatDate(order.date)}
                    </div>
                  </td>
                  <td className="px-2 py-5 text-slate-900 font-black">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      {order.customerName}
                    </div>
                  </td>
                  <td className="px-2 py-5 text-right text-slate-900 font-black tabular-nums text-sm">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
      
    <AnimatePresence>
        {activeMenuOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveMenuOrder(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-xs overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Order Options</h4>
                <button 
                  onClick={() => setActiveMenuOrder(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    onToggleHold(activeMenuOrder.id);
                    setActiveMenuOrder(null);
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-700 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <Anchor className="w-5 h-5" />
                    </div>
                    <span className="font-bold">{activeMenuOrder.isHeld ? 'Unhold Order' : 'Hold Order'}</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    onDeleteOrder(activeMenuOrder.id);
                    setActiveMenuOrder(null);
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <span className="font-bold">Delete Order</span>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    </div>
  );
};

export default OrderList;
