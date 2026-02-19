
import React, { useState, useMemo } from 'react';
import { SaleRecord, PivotConfig, SortOrder } from '../types';
import { Filter, SortDesc, SortAsc } from 'lucide-react';

interface PivotTableProps {
  data: SaleRecord[];
  headers: string[];
}

const PivotTable: React.FC<PivotTableProps> = ({ data, headers }) => {
  // Map logical names to actual data keys
  const findKey = (candidates: string[]) => {
    const lowerHeaders = headers.map(h => h.toLowerCase());
    for (const cand of candidates) {
      const idx = lowerHeaders.findIndex(h => h.includes(cand.toLowerCase()));
      if (idx !== -1) return headers[idx];
    }
    return candidates[0]; // Fallback to first candidate name
  };

  const itemKey = findKey(['productName', 'item']);
  const customerKey = findKey(['customerName', 'customer', 'customers']);
  const subtotalKey = 'subtotal'; // Virtual field from service
  const countKey = 'countValue'; // Derived from Column R in dataService

  const [config, setConfig] = useState<PivotConfig>({
    rowField: itemKey,
    colField: 'none',
    metric: subtotalKey,
    sortOrder: 'desc',
  });

  const pivotData = useMemo(() => {
    const rows = new Set<string>();
    const matrix: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    let grandTotal = 0;

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Filter for last 30 days
    const filteredData = data.filter(item => {
      const orderDate = new Date(item.orderDate);
      return orderDate >= thirtyDaysAgo && orderDate <= now;
    });

    filteredData.forEach((item) => {
      const rowVal = String(item[config.rowField] ?? 'N/A');
      const colVal = 'Grand Total';
      
      const val = item[config.metric];
      const metricVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, '')) || 0;

      rows.add(rowVal);

      if (!matrix[rowVal]) matrix[rowVal] = {};
      matrix[rowVal][colVal] = (matrix[rowVal][colVal] || 0) + metricVal;
      
      rowTotals[rowVal] = (rowTotals[rowVal] || 0) + metricVal;
      grandTotal += metricVal;
    });

    let sortedRows = Array.from(rows);
    const sortedCols = ['Grand Total'];

    // Apply Sorting based on Row Grand Total
    if (config.sortOrder === 'alpha') {
      sortedRows.sort();
    } else if (config.sortOrder === 'desc') {
      sortedRows.sort((a, b) => (rowTotals[b] || 0) - (rowTotals[a] || 0));
    } else if (config.sortOrder === 'asc') {
      sortedRows.sort((a, b) => (rowTotals[a] || 0) - (rowTotals[b] || 0));
    }

    return { sortedRows, sortedCols, matrix, rowTotals, grandTotal, filteredCount: filteredData.length };
  }, [data, config, itemKey, customerKey, subtotalKey, countKey]);

  const formatValue = (val: number) => {
    const isCurrency = config.metric === subtotalKey;
    if (isCurrency) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  const SelectorButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
        active 
          ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' 
          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Controls */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Row Selection */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Group By (Rows)</label>
          <div className="flex gap-2">
            <SelectorButton 
              label="Item" 
              active={config.rowField === itemKey} 
              onClick={() => setConfig({ ...config, rowField: itemKey })} 
            />
            <SelectorButton 
              label="Customers" 
              active={config.rowField === customerKey} 
              onClick={() => setConfig({ ...config, rowField: customerKey })} 
            />
          </div>
        </div>

        {/* Metric Selection */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Aggregate (Metric)</label>
          <div className="flex gap-2">
            <SelectorButton 
              label="Subtotal" 
              active={config.metric === subtotalKey} 
              onClick={() => setConfig({ ...config, metric: subtotalKey })} 
            />
            <SelectorButton 
              label="Count" 
              active={config.metric === countKey} 
              onClick={() => setConfig({ ...config, metric: countKey })} 
            />
          </div>
        </div>

        {/* Sort Selection */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Sort Sequence</label>
          <div className="relative">
            <select
              value={config.sortOrder}
              onChange={(e) => setConfig({ ...config, sortOrder: e.target.value as SortOrder })}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-700 font-bold text-xs uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="alpha">Alphabetical (A-Z)</option>
              <option value="desc">Highest Performance</option>
              <option value="asc">Lowest Performance</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {config.sortOrder === 'desc' ? <SortDesc className="w-4 h-4 text-blue-600" /> : 
                 config.sortOrder === 'asc' ? <SortAsc className="w-4 h-4 text-blue-600" /> : 
                 <SortAsc className="w-4 h-4 text-slate-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 font-black text-slate-400 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 uppercase tracking-widest text-[10px]">
                  {config.rowField === itemKey ? 'Product / Item' : 'Customer Entity'}
                </th>
                <th className="px-8 py-5 font-black text-blue-600 text-right uppercase tracking-widest text-[10px] bg-blue-50/30">
                  {config.metric === subtotalKey ? 'Total Revenue (USD)' : 'Total Count (Col R)'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pivotData.sortedRows.map((row, idx) => (
                <tr key={row} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-8 py-5 font-black text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100 group-hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-300 w-4">{idx + 1}</span>
                      {row}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-slate-900 bg-slate-50/10 tabular-nums text-lg">
                    {formatValue(pivotData.rowTotals[row])}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white border-t-2 border-slate-800">
              <tr>
                <td className="px-8 py-6 font-black uppercase tracking-widest text-[10px] sticky left-0 bg-slate-900 italic">Portfolio Grand Total (30D)</td>
                <td className="px-8 py-6 text-right font-black text-blue-400 tabular-nums text-2xl">
                  {formatValue(pivotData.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
        <Filter className="w-4 h-4 shrink-0" />
        <span>Aggregating <b>{config.metric === subtotalKey ? 'Subtotal' : 'Count'}</b> for <b>{pivotData.sortedRows.length}</b> entities across <b>{pivotData.filteredCount}</b> transactions from the last 30 days.</span>
      </div>
    </div>
  );
};

export default PivotTable;
