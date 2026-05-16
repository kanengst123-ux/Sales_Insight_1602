import React from 'react';
import { SavedOrder } from '../types';
import { Calendar, User, DollarSign, MessageSquare, UserCircle, Plus } from 'lucide-react';

interface OrderListProps {
  orders: SavedOrder[];
  onEditOrder: (order: SavedOrder) => void;
  currentRole: string | null;
  onNewOrder: () => void;
}

const OrderList: React.FC<OrderListProps> = ({ orders, onEditOrder, currentRole, onNewOrder }) => {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-16 flex flex-col items-center text-center gap-6 shadow-sm border border-slate-200 relative overflow-hidden">
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
        <div className="px-8 py-4 bg-slate-50/30 border-b border-slate-100 flex items-center justify-between">
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
              <th className="px-4 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px] w-px text-center">Date</th>
              <th className="px-8 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Customer Name</th>
              <th className="px-8 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Order Amount</th>
              <th className="px-8 py-6 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Sales Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.map((order) => (
              <React.Fragment key={order.id}>
                <tr 
                  onClick={() => onEditOrder(order)}
                  className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                >
                  <td className="px-4 py-5 text-slate-500 font-bold whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      {formatDate(order.date)}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-slate-900 font-black">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      {order.customerName}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right text-slate-900 font-black tabular-nums text-base">
                    <div className="flex items-center justify-end gap-1 text-emerald-600">
                      <DollarSign className="w-4 h-4" />
                      {order.orderAmount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-slate-600 font-bold">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-3.5 h-3.5 text-slate-400" />
                      {order.salesName}
                    </div>
                  </td>
                </tr>
                {order.remark && (
                  <tr 
                    onClick={() => onEditOrder(order)}
                    className="border-t-0 bg-slate-50/30 hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td />
                    <td colSpan={3} className="px-8 py-3 pb-5">
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
  </div>
);
};

export default OrderList;
