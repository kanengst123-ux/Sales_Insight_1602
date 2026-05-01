
import React, { useState, useEffect, useMemo } from 'react';
import { fetchCustomerGrades } from '../services/dataService';
import { Users, Save, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface GradeItem {
  customer: string;
  sales: string;
  category: string;
}

const CustomerGrades: React.FC = () => {
  const [data, setData] = useState<GradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSales, setSelectedSales] = useState<string>('EVA');
  const [tempGrades, setTempGrades] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  const salesPeople = ['EVA', 'KATIE', 'YO', 'KASEY'];

  useEffect(() => {
    const loadGrades = async () => {
      setLoading(true);
      const grades = await fetchCustomerGrades();
      
      const initialTemp: Record<string, string> = {};
      grades.forEach(item => {
        initialTemp[item.customer] = item.category;
      });
      
      // Batch these updates to avoid redundant expensive re-sorts during initialization
      setData(grades);
      setTempGrades(initialTemp);
      setLoading(false);
    };
    loadGrades();
  }, []);

  const filteredItems = useMemo(() => {
    const salesFilter = selectedSales.toUpperCase();
    
    // 1. Filter by sales person
    const filtered = data.filter(item => item.sales.toUpperCase() === salesFilter);
    
    // 2. Sort the data
    // Optimization: We sort based on the category in the master data (initial state)
    // rather than the temporary state to prevent the list from jumping while the user is clicking.
    return filtered.sort((a, b) => {
      const categoryA = a.category?.trim() || '';
      const categoryB = b.category?.trim() || '';
      
      // Prioritize unranked (empty string)
      if (categoryA === '' && categoryB !== '') return -1;
      if (categoryA !== '' && categoryB === '') return 1;
      
      // Secondary sort by name
      if (a.customer < b.customer) return -1;
      if (a.customer > b.customer) return 1;
      return 0;
    });
  }, [data, selectedSales]); // Removed tempGrades from dependencies

  const handleGradeChange = (customer: string, grade: string) => {
    setTempGrades(prev => ({
      ...prev,
      [customer]: grade
    }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    
    // Hardcoded URL for production/GitHub Pages compatibility
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbxWGTRyxsujR-InMF-oGELmQ1ew5P27yIakOnP5EyLALvelZEJNpfMfgVZWzrY3Wpj7fw/exec';

    try {
      // Create a payload with current selections
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tempGrades)
      });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('idle');
      alert('Failed to connect to Google Script. Check your internet connection or deployment settings.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold uppercase tracking-widest text-[10px]">Loading Customer Grades...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top Controls */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {salesPeople.map(person => (
            <button
              key={person}
              onClick={() => setSelectedSales(person)}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all border ${
                selectedSales === person 
                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' 
                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {person}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={`w-full md:w-auto flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all shadow-lg active:scale-95 ${
            saveStatus === 'success' 
            ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
            : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800'
          }`}
        >
          {saveStatus === 'saving' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveStatus === 'success' ? 'GRADES SAVED' : 'SAVE CHANGES'}
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-4 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-2 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12 md:w-24">A</th>
                <th className="px-2 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12 md:w-24">B</th>
                <th className="px-2 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12 md:w-24">C</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 md:px-8 py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="w-10 h-10 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">No customers found for {selectedSales}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 md:px-8 py-4 md:py-6">
                      <span className="text-slate-900 font-bold text-sm md:text-base leading-tight block line-clamp-2 md:line-clamp-none">{item.customer}</span>
                    </td>
                    {['A', 'B', 'C'].map(grade => (
                      <td key={grade} className="px-1 md:px-8 py-4 md:py-6 text-center">
                        <button
                          onClick={() => handleGradeChange(item.customer, grade)}
                          className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all flex items-center justify-center mx-auto ${
                            tempGrades[item.customer] === grade
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105 md:scale-110'
                            : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          {tempGrades[item.customer] === grade ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : <span className="font-bold text-[10px] md:text-xs uppercase">{grade}</span>}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 flex items-start gap-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-emerald-900 uppercase tracking-widest">Connected to Google Sheets</p>
          <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
            This tab is synced with your master Google Sheet. Clicking "Save" will instantly update Category (Col C) for the selected customers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerGrades;
