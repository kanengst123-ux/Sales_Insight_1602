
import React from 'react';
import { SalesAnalytics, InsightReport } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { TrendingUp, DollarSign, Package, CheckCircle2, Lightbulb, Activity, MessageSquare } from 'lucide-react';

interface DashboardProps {
  analytics: SalesAnalytics;
  insights: InsightReport | null;
  isAnalyzing: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; trend: string; bgColor: string }> = ({ label, value, icon, trend, bgColor }) => (
  <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-20 h-20 ${bgColor} rounded-full -mr-8 -mt-8 opacity-20 group-hover:scale-110 transition-transform`} />
    <div className="relative z-10">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-white shadow-sm ring-1 ring-slate-100">
        {icon}
      </div>
      <p className="text-slate-500 font-bold text-[10px] md:text-xs uppercase tracking-widest">{label}</p>
      <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-0.5">{value}</h3>
      <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded-full mt-2">
        {trend}
      </p>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ analytics, insights, isAnalyzing }) => {
  const categoryData = Object.entries(analytics.salesByCategory).map(([name, value]) => ({ name, value }));
  const regionData = Object.entries(analytics.salesByRegion).map(([name, value]) => ({ name, value }));
  const timelineData = Object.entries(analytics.salesByMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, sales]) => ({ date, sales }));

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <KpiCard 
          label="Revenue" 
          value={`$${analytics.totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={<DollarSign className="w-5 h-5 text-blue-600" />}
          trend="+12.5% vs LW"
          bgColor="bg-blue-100"
        />
        <KpiCard 
          label="Net Profit" 
          value={`$${analytics.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          trend="+5.2% vs LW"
          bgColor="bg-emerald-100"
        />
        <KpiCard 
          label="Orders" 
          value={analytics.totalOrders.toLocaleString()}
          icon={<Package className="w-5 h-5 text-amber-600" />}
          trend="+3.1% vs LW"
          bgColor="bg-amber-100"
        />
        <KpiCard 
          label="Avg Order" 
          value={`$${analytics.averageOrderValue.toFixed(0)}`}
          icon={<Activity className="w-5 h-5 text-purple-600" />}
          trend="+0.8% vs LW"
          bgColor="bg-purple-100"
        />
      </div>

      {/* AI Insights Section */}
      {(insights || isAnalyzing) && (
        <section className="bg-slate-900 text-white rounded-[2rem] p-6 md:p-10 shadow-2xl relative overflow-hidden border border-slate-700 ring-4 ring-blue-500/10">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <MessageSquare size={160} />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Lightbulb className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight">AI Strategic Brief</h3>
                <p className="text-blue-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Gemini Analysis Engine</p>
              </div>
            </div>

            {isAnalyzing ? (
              <div className="space-y-6">
                <div className="h-4 bg-slate-800 rounded-full w-3/4 animate-pulse"></div>
                <div className="h-4 bg-slate-800 rounded-full w-1/2 animate-pulse"></div>
                <div className="h-4 bg-slate-800 rounded-full w-2/3 animate-pulse"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <p className="text-slate-200 leading-relaxed text-base md:text-xl font-medium italic border-l-4 border-blue-500 pl-4 md:pl-6 py-2">
                    "{insights?.summary}"
                  </p>
                  <div className="mt-8">
                    <h4 className="text-blue-400 font-bold mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
                      <TrendingUp className="w-4 h-4" /> Growth Catalysts
                    </h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {insights?.keyDrivers.map((driver, i) => (
                        <li key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                          <span className="text-slate-300 text-sm font-medium leading-tight">{driver}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="bg-slate-800/50 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-xl self-start">
                  <h4 className="text-emerald-400 font-bold mb-6 text-xs uppercase tracking-widest">Priority Actions</h4>
                  <ul className="space-y-4">
                    {insights?.recommendations.map((rec, i) => (
                      <li key={i} className="group flex items-start gap-4">
                        <span className="flex-none w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-[10px] group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          {i + 1}
                        </span>
                        <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">{rec}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Sales Timeline */}
        <div className="bg-white p-5 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 text-sm md:text-lg uppercase tracking-tight">Revenue Trajectory</h3>
            <span className="text-[10px] font-black px-3 py-1 bg-blue-50 rounded-full text-blue-600 uppercase tracking-widest">Monthly</span>
          </div>
          <div className="h-[250px] md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={5} dot={false} activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Distribution */}
        <div className="bg-white p-5 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 text-sm md:text-lg uppercase tracking-tight">Market Strength</h3>
            <span className="text-[10px] font-black px-3 py-1 bg-slate-100 rounded-full text-slate-500 uppercase tracking-widest">Regional</span>
          </div>
          <div className="h-[250px] md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={70} tickLine={false} axisLine={false} fontVariant="bold" />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={30}>
                  {regionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
