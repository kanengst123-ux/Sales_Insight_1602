
import React from 'react';
import { SalesAnalytics, InsightReport } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';
import { TrendingUp, DollarSign, CheckCircle2, Lightbulb, MessageSquare, Users } from 'lucide-react';

interface DashboardProps {
  analytics: SalesAnalytics;
  insights: InsightReport | null;
  isAnalyzing: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; trend: string; bgColor: string }> = ({ label, value, icon, trend, bgColor }) => (
  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group h-full flex flex-col justify-center">
    <div className={`absolute top-0 right-0 w-24 h-24 ${bgColor} rounded-full -mr-8 -mt-8 opacity-20 group-hover:scale-110 transition-transform`} />
    <div className="relative z-10">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-white shadow-sm ring-1 ring-slate-100">
        {icon}
      </div>
      <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{label}</p>
      <h3 className="text-3xl md:text-4xl font-black text-slate-900 mt-1">{value}</h3>
      <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 inline-block px-3 py-1 rounded-full mt-3 uppercase tracking-wider">
        {trend}
      </p>
    </div>
  </div>
);

const UserSalesChart: React.FC<{ title: string, sub: string, data: Record<string, number> }> = ({ title, sub, data }) => {
  // Fix: Explicitly convert values to Number to avoid TypeScript arithmetic operation errors
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => Number(b.value) - Number(a.value));

  return (
    <div className="bg-white p-5 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="font-black text-slate-800 text-sm md:text-lg uppercase tracking-tight">{title}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sum of Subtotal</p>
        </div>
        <span className="text-[10px] font-black px-3 py-1 bg-slate-100 rounded-full text-slate-500 uppercase tracking-widest">{sub}</span>
      </div>
      <div className="h-[250px] md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              stroke="#64748b" 
              fontSize={11} 
              width={60} 
              tickLine={false} 
              axisLine={false} 
              fontVariant="bold"
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Subtotal']}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={32}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ analytics, insights, isAnalyzing }) => {
  // Aggregate daily data for the Revenue Trajectory
  const dailyData = Object.entries(analytics.salesByDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, sales]) => ({ 
      date, 
      sales,
      formattedDate: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }));

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700">
      {/* KPI Section - Highlighted Single Card */}
      <div className="grid grid-cols-1 gap-6">
        <KpiCard 
          label="Total Gross Revenue" 
          value={`$${analytics.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="w-6 h-6 text-blue-600" />}
          trend="+12.5% Performance Growth"
          bgColor="bg-blue-100"
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
        {/* Daily Sales Bar Chart */}
        <div className="bg-white p-5 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 text-sm md:text-lg uppercase tracking-tight">Revenue Trajectory</h3>
            <span className="text-[10px] font-black px-3 py-1 bg-blue-50 rounded-full text-blue-600 uppercase tracking-widest">Daily Sum (Subtotal)</span>
          </div>
          <div className="h-[250px] md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="formattedDate" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                  minTickGap={30}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `$${val.toLocaleString()}`} 
                />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#3b82f6' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Subtotal Sum']}
                />
                <Bar 
                  dataKey="sales" 
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]} 
                  barSize={dailyData.length > 50 ? undefined : 20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Strength - Past 7 Days */}
        <UserSalesChart 
          title="Market Strength (7D)" 
          sub="Last 7 Days" 
          data={analytics.userSalesPastWeek} 
        />

        {/* Market Strength - Past 30 Days */}
        <UserSalesChart 
          title="Market Strength (30D)" 
          sub="Last 30 Days" 
          data={analytics.userSalesPast30Days} 
        />
      </div>
    </div>
  );
};

export default Dashboard;
