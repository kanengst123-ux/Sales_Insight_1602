
import { SaleRecord, SalesAnalytics, SalesData } from '../types';

// The default ID provided by the user
const DEFAULT_SHEET_ID = '10gGU4ZZH_qUKwYklfIK0sQFNCUCfUc36C3SpkfUoQlA';

const getExportUrl = (id: string) => {
  // If it's a full URL, try to extract the ID, otherwise assume it's an ID
  const sheetId = id.includes('docs.google.com') 
    ? id.match(/[-\w]{25,}/)?.[0] || id 
    : id;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
};

const parseCSV = (text: string): string[][] => {
  const result: string[][] = [];
  let row: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        row.push(currentField.trim());
        if (row.length > 0 && row.some(cell => cell.length > 0)) {
          result.push(row);
        }
        row = [];
        currentField = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== '' || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(cell => cell.length > 0)) {
      result.push(row);
    }
  }

  return result;
};

const normalizeKey = (h: string | undefined): string => {
  if (typeof h !== 'string') return '';
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const findColumn = (headers: (string | undefined)[], keywords: string[]): number => {
  const normalizedHeaders = headers.map(h => normalizeKey(h));
  for (const keyword of keywords) {
    const idx = normalizedHeaders.findIndex(h => h.includes(keyword.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
};

export const fetchSalesData = async (customId?: string): Promise<{ data: SalesData; source: 'cloud' | 'local' }> => {
  const targetId = customId || DEFAULT_SHEET_ID;
  const DATA_URL = getExportUrl(targetId);

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Cloud fetch failed');

    const text = await response.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('Empty dataset');

    const resultData = processRows(rows);
    return { data: resultData, source: 'cloud' };
  } catch (error) {
    console.warn('Syncing with Google Drive failed, falling back to local data.csv', error);
    try {
      const localResponse = await fetch('./data.csv');
      if (!localResponse.ok) throw new Error('Local fallback failed');
      const localText = await localResponse.text();
      const localRows = parseCSV(localText);
      return { data: processRows(localRows), source: 'local' };
    } catch (localError) {
      throw new Error('No data source available. Please check your internet connection or the provided Sheet ID.');
    }
  }
};

const processRows = (rows: string[][]): SalesData => {
  const headers = rows[0];
  const cleanHeaders = headers.filter(h => h && h.trim() && h !== '.');

  const idx = {
    orderId: findColumn(headers, ['ref', 'invoice', 'orderid']),
    orderDate: findColumn(headers, ['date', 'delivered', 'paiddate']),
    customerName: findColumn(headers, ['customer', 'user']),
    segment: findColumn(headers, ['out', 'segment', 'unit']),
    region: findColumn(headers, ['district', 'region', 'area']),
    category: findColumn(headers, ['item', 'category', 'product']),
    subCategory: findColumn(headers, ['subcategory', 'type']),
    productName: findColumn(headers, ['item', 'product', 'description']),
    sales: findColumn(headers, ['subtotal', 'sales', 'total', 'paid']),
    quantity: findColumn(headers, ['quantity', 'count', 'qty']),
    profit: findColumn(headers, ['profit', 'margin', 'earning'])
  };

  const records: SaleRecord[] = rows.slice(1).map((row, rowIdx) => {
    const record: any = {};
    headers.forEach((h, i) => {
      if (h && h.trim()) {
        const val = row[i] ?? '';
        if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.replace(/[$,]/g, ''))) {
          record[h] = parseFloat(val.replace(/[$,]/g, ''));
        } else {
          record[h] = val;
        }
      }
    });

    const getVal = (colIndex: number) => {
      if (colIndex === -1 || colIndex >= row.length) return '';
      return row[colIndex] ?? '';
    };
    
    const parseNum = (val: string) => {
      if (!val) return 0;
      return parseFloat(val.toString().replace(/[^0-9.-]/g, '')) || 0;
    };

    const salesVal = parseNum(getVal(idx.sales));
    return {
      ...record,
      orderId: getVal(idx.orderId) || `REF-${rowIdx + 1}`,
      orderDate: getVal(idx.orderDate) || new Date().toISOString(),
      customerName: getVal(idx.customerName) || 'Walk-in',
      segment: getVal(idx.segment) || 'Standard',
      region: getVal(idx.region) || 'General',
      category: getVal(idx.category) || 'Products',
      subCategory: getVal(idx.subCategory) || '',
      productName: getVal(idx.productName) || 'Standard Item',
      sales: salesVal,
      quantity: parseInt(getVal(idx.quantity).toString().replace(/[^0-9]/g, '')) || 0,
      profit: idx.profit !== -1 ? parseNum(getVal(idx.profit)) : salesVal * 0.15,
    };
  });

  return { records, headers: cleanHeaders };
};

export const calculateAnalytics = (data: SaleRecord[]): SalesAnalytics => {
  const analytics: SalesAnalytics = {
    totalSales: 0,
    totalProfit: 0,
    totalOrders: data.length,
    averageOrderValue: 0,
    salesByCategory: {},
    salesByRegion: {},
    salesByMonth: {},
  };

  data.forEach(item => {
    analytics.totalSales += item.sales || 0;
    analytics.totalProfit += item.profit || 0;
    
    if (item.category) {
      analytics.salesByCategory[item.category] = (analytics.salesByCategory[item.category] || 0) + item.sales;
    }
    if (item.region) {
      analytics.salesByRegion[item.region] = (analytics.salesByRegion[item.region] || 0) + item.sales;
    }
    
    const dateStr = item.orderDate;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      analytics.salesByMonth[monthYear] = (analytics.salesByMonth[monthYear] || 0) + item.sales;
    }
  });

  analytics.averageOrderValue = analytics.totalOrders > 0 ? analytics.totalSales / analytics.totalOrders : 0;
  return analytics;
};
