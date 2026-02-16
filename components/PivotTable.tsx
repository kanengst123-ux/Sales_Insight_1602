
import React, { useState, useMemo, useEffect } from 'react';
import { SaleRecord, PivotConfig, SortOrder } from '../types';
import { ChevronDown, Filter, SortDesc, SortAsc } from 'lucide-react';

interface PivotTableProps {
  data: SaleRecord[];
  headers: string[];
}

const PivotTable: React.FC<PivotTableProps> = ({ data, headers }) => {
  // Select sensible defaults from available headers
  const defaultRow = headers.find(h => ['district', 'item', 'customer', 'user', 'customers'].includes(h.toLowerCase())) || headers[0];
  const defaultCol = headers.find(h => ['unit', 'out', 'status', 'delivered'].includes(h.toLowerCase())) || 'none';
  const defaultMetric = headers.find(h => ['subtotal', 'price', 'quantity', 'paid', 'total'].includes(h.toLowerCase())) || headers[headers.length - 1];

  const [config, setConfig] = useState<PivotConfig>({
    rowField: defaultRow,
    colField: defaultCol,
    metric: defaultMetric,
    sortOrder: 'desc', // Default to highest to lowest as requested
  });

  // Ensure current config is valid if headers change
  useEffect(() => {
    if (!headers.includes(config.rowField)) {
      setConfig(prev => ({ ...prev, rowField: headers[0] }));
    }
    if (config.colField !== 'none' && !headers.includes(config.colField)) {
      setConfig(prev => ({ ...prev, colField: 'none' }));
    }
    if (!headers.includes(config.metric)) {
      setConfig(prev => ({ ...prev, metric: headers[headers.length - 1] }));
    }
  }, [headers]);

  const pivotData = useMemo(() => {
    const rows = new Set<string>();
    const cols = new Set<string>();
    const matrix: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;

    data.forEach((item) => {
      const rowVal = String(item[config.rowField] ?? 'N/A');
      const colVal = config.colField === 'none' ? 'Grand Total' : String(item[config.colField] ?? 'N/A');
      
      const val = item[config.metric];
      const metricVal = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, '')) || 0;

      rows.add(rowVal);
      cols.add(colVal);

      if (!matrix[rowVal]) matrix[rowVal] = {};
      matrix[rowVal][colVal] = (matrix[rowVal][colVal] || 0) + metricVal;
      
      rowTotals[rowVal] = (rowTotals[rowVal] || 0) + metricVal;
      colTotals[colVal] = (colTotals[colVal] || 0) + metricVal;
      grandTotal += metricVal;
    });

    let sortedRows = Array.from(rows);
    const sortedCols = Array.from(cols).sort();

    // Apply Sorting based on Row Grand Total
    if (config.sortOrder === 'alpha') {
      sortedRows.sort();
    } else if (config.sortOrder === 'desc') {
      sortedRows.sort((a, b) => (rowTotals[b] || 0) - (rowTotals[a] || 0));
    } else if (config.sortOrder === 'asc') {
      sortedRows.sort((a, b) => (rowTotals[a] || 0) - (rowTotals[b] || 0));
    }

    return { sortedRows, sortedCols, matrix, rowTotals, colTotals, grandTotal };
  }, [data, config]);

  const formatValue = (val: number) => {
    const isCurrency = ['subtotal', 'price', 'paid', 'total', 'sales', 'profit'].some(k => config.metric.toLowerCase().includes(k));
    if (isCurrency) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Controls */}
      <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rows</label>
          <div className="relative">
            <select
              value={config.rowField}
              onChange={(e) => setConfig({ ...config, rowField: e.target.value })}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              {headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Columns</label>
          <div className="relative">
            <select
              value={config.colField}
              onChange={(e) => setConfig({ ...config, colField: e.target.value })}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="none">None (Summary Only)</option>
              {headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Metric</label>
          <div className="relative">
            <select
              value={config.metric}
              onChange={(e) => setConfig({ ...config, metric: e.target.value })}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              {headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sort By Grand Total</label>
          <div className="relative">
            <select
              value={config.sortOrder}
              onChange={(e) => setConfig({ ...config, sortOrder: e.target.value as SortOrder })}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="alpha">Alphabetical (A-Z)</option>
              <option value="desc">Highest to Lowest</option>
              <option value="asc">Lowest to Highest</option>
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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-600 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 uppercase tracking-wider text-[10px]">
                  {config.rowField}
                </th>
                {pivotData.sortedCols.map(col => (
                  <th key={col} className="px-6 py-4 font-bold text-slate-600 text-right uppercase tracking-wider text-[10px] min-w-[120px]">
                    {col}
                  </th>
                ))}
                {config.colField !== 'none' && (
                  <th className="px-6 py-4 font-bold text-blue-600 text-right uppercase tracking-wider text-[10px] bg-blue-50/30">
                    Grand Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pivotData.sortedRows.map(row => (
                <tr key={row} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100 group-hover:bg-slate-50">
                    {row}
                  </td>
                  {pivotData.sortedCols.map(col => (
                    <td key={col} className="px-6 py-4 text-right text-slate-600 font-medium tabular-nums">
                      {pivotData.matrix[row][col] ? formatValue(pivotData.matrix[row][col]) : '-'}
                    </td>
                  ))}
                  {config.colField !== 'none' && (
                    <td className="px-6 py-4 text-right font-black text-slate-900 bg-slate-50/30 tabular-nums">
                      {formatValue(pivotData.rowTotals[row])}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white border-t-2 border-slate-800">
              <tr>
                <td className="px-6 py-5 font-black uppercase tracking-widest text-[10px] sticky left-0 bg-slate-900">Total</td>
                {pivotData.sortedCols.map(col => (
                  <td key={col} className="px-6 py-5 text-right font-black tabular-nums">
                    {formatValue(pivotData.colTotals[col])}
                  </td>
                ))}
                {config.colField !== 'none' && (
                  <td className="px-6 py-5 text-right font-black text-blue-400 tabular-nums">
                    {formatValue(pivotData.grandTotal)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-2xl text-xs font-medium border border-blue-100">
        <Filter className="w-4 h-4 shrink-0" />
        <span>Currently displaying <b>{config.metric}</b> aggregated by <b>{config.rowField}</b> {config.colField !== 'none' && <>and <b>{config.colField}</b></>}. Sorting by <b>Total {config.sortOrder === 'desc' ? '(Highest First)' : config.sortOrder === 'asc' ? '(Lowest First)' : '(A-Z)'}</b>.</span>
      </div>
    </div>
  );
};

export default PivotTable;
