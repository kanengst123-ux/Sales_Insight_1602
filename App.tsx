
import React, { useState, useEffect, useCallback } from 'react';
import { fetchSalesData, calculateAnalytics } from './services/dataService';
import { SaleRecord, SalesAnalytics } from './types';
import Dashboard from './components/Dashboard';
import PivotTable from './components/PivotTable';
import CollectionsTable from './components/CollectionsTable';
import InactiveCustomers from './components/InactiveCustomers';
import CustomerGrades from './components/CustomerGrades';
import { Layout, BarChart3, Database, RefreshCw, AlertCircle, Loader2, Table as TableIcon, Menu, X, FileQuestion, Globe, HardDrive, Settings2, ReceiptText, UserX, Award } from 'lucide-react';

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pivot' | 'collections' | 'inactive' | 'grades'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<'cloud' | 'local'>('cloud');
  const [sheetId, setSheetId] = useState<string>('');

  const loadData = useCallback(async (customId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, source } = await fetchSalesData(customId);
      if (data.records.length === 0) {
        setError('No sales records found in the dataset.');
      } else {
        setRecords(data.records);
        setHeaders(data.headers);
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
    loadData();
  }, []);

  const NavItems = () => (
    <>
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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row">
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

      <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${dataSource === 'cloud' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${dataSource === 'cloud' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {dataSource === 'cloud' ? 'Live Cloud Sync' : 'Offline Mode (Local)'}
                </span>
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                {activeTab === 'dashboard' ? 'Performance Hub' : activeTab === 'pivot' ? '過往三十天銷售記錄' : activeTab === 'collections' ? '及單+未到期票' : activeTab === 'inactive' ? '7天以上冇落單' : activeTab === 'grades' ? '客戶等級' : 'Transaction Log'}
              </h2>
            </div>
            
            {/* AI Analysis button removed */}
          </header>

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
            <InactiveCustomers data={records} />
          ) : activeTab === 'grades' ? (
            <CustomerGrades />
          ) : activeTab === 'pivot' ? (
            <PivotTable data={records} headers={headers} />
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around p-3 z-30 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
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
      </nav>
      <div className="h-20 md:hidden" />
    </div>
  );
};

export default App;
