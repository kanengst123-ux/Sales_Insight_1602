
import { SaleRecord, SalesAnalytics, SalesData } from '../types';

const DEFAULT_SHEET_ID = '10gGU4ZZH_qUKwYklfIK0sQFNCUCfUc36C3SpkfUoQlA';

const getExportUrl = (id: string) => {
  const sheetId = id.includes('docs.google.com') 
    ? id.match(/[-\w]{25,}/)?.[0] || id 
    : id;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
};

export const parseCSV = (text: string): string[][] => {
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
        if (row.length > 0) {
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

const findColumn = (headers: (string | undefined)[], keywords: string[]): number => {
  const normalizedHeaders = headers.map(h => h?.toLowerCase().replace(/[^a-z0-9]/g, '') || '');
  for (const keyword of keywords) {
    const idx = normalizedHeaders.findIndex(h => h.includes(keyword.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
};

const parseNum = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = val.toString().replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export const fetchCustomerGrades = async (): Promise<any[]> => {
  const URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vStdyv4mUaIdO-jPeUwBfxMxBZbCkbNEtk8VNhyrpiAInlNb7w3jli2jYtERyVPp94aWMeVuP4N0XNv/pub?gid=1793390915&single=true&output=csv';
  try {
    const response = await fetch(URL);
    if (!response.ok) throw new Error('Failed to fetch customer grades');
    const text = await response.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      customer: row[0] || '',
      sales: row[1] || '',
      category: row[2] || ''
    }));
  } catch (error) {
    console.error('Error fetching customer grades:', error);
    return [];
  }
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
    console.warn('Syncing fallback to local data', error);
    try {
      const localResponse = await fetch('./data.csv');
      if (!localResponse.ok) throw new Error('Local fallback failed');
      const localText = await localResponse.text();
      const localRows = parseCSV(localText);
      return { data: processRows(localRows), source: 'local' };
    } catch (localError) {
      throw new Error('No data source available.');
    }
  }
};

const processRows = (rows: string[][]): SalesData => {
  const headers = rows[0];
  const cleanHeaders = headers.filter(h => h && h.trim());

  const MAP = {
    item: 1,        // B
    quantity: 3,    // D
    unit: 4,        // E
    price: 6,       // G
    customer: 7,    // H
    subtotal: 9,    // J
    user: 10,       // K
    paid: 12,       // M
    countCol: 17,   // R
    colS: 18        // S
  };

  const idx = {
    orderId: findColumn(headers, ['orderid', 'ref', 'invoice']),
    orderDate: findColumn(headers, ['orderdate', 'date']),
    customerName: findColumn(headers, ['customer', 'user']),
    sales: findColumn(headers, ['sales', 'total']),
    quantity: findColumn(headers, ['quantity', 'qty']),
    profit: findColumn(headers, ['profit']),
  };

  const dataRows = rows.slice(1).filter(row => {
    const id = (row[idx.orderId] || '').toString().trim();
    const customer = (row[MAP.customer] || row[idx.customerName] || '').toString().trim();
    return id !== '' || customer !== '';
  });

  const records: SaleRecord[] = dataRows.map((row, rowIdx) => {
    const record: any = {};
    headers.forEach((h, i) => {
      if (h && h.trim()) record[h] = row[i] || '';
    });

    const getRaw = (colIndex: number) => {
      if (colIndex < 0 || colIndex >= row.length) return '';
      return (row[colIndex] || '').toString().trim();
    };
    
    const recordSubtotal = parseNum(getRaw(MAP.subtotal));

    return {
      ...record,
      orderId: getRaw(idx.orderId) || `REF-${rowIdx + 1}`,
      orderDate: getRaw(idx.orderDate) || new Date().toISOString(),
      customerName: getRaw(MAP.customer) || getRaw(idx.customerName) || 'Unknown',
      userName: getRaw(MAP.user) || 'Unknown',
      segment: record.segment || 'Standard',
      region: record.region || 'General',
      category: record.category || 'Products',
      subCategory: record.subCategory || '',
      productName: getRaw(MAP.item) || record.productName || 'Standard Item',
      sales: parseNum(getRaw(idx.sales)) || recordSubtotal,
      quantity: parseInt(getRaw(MAP.quantity).replace(/[^0-9]/g, '')) || parseInt(getRaw(idx.quantity).replace(/[^0-9]/g, '')) || 0,
      profit: parseNum(getRaw(idx.profit)) || recordSubtotal * 0.15,
      subtotal: recordSubtotal,
      paidStatus: getRaw(MAP.paid),
      paidDate: getRaw(MAP.paid),
      colSValue: getRaw(MAP.colS),
      countValue: parseNum(getRaw(MAP.countCol)),
      unit: getRaw(MAP.unit),
      price: parseNum(getRaw(MAP.price))
    };
  });

  return { records, headers: cleanHeaders };
};

const normalizeUser = (name: string): string | null => {
  const n = name.trim().toLowerCase();
  if (n === 'eva') return 'Eva';
  if (n === 'yo') return 'Yo';
  if (n === 'katie') return 'Katie';
  if (n === 'kasey') return 'Kasey';
  return null;
};

export const calculateAnalytics = (data: SaleRecord[]): SalesAnalytics => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const analytics: SalesAnalytics = {
    totalSales: 0,
    totalProfit: 0,
    totalOrders: data.length,
    averageOrderValue: 0,
    salesByCategory: {},
    salesByRegion: {},
    salesByMonth: {},
    salesByDay: {},
    userSalesPastWeek: { 'Eva': 0, 'Yo': 0, 'Katie': 0, 'Kasey': 0 },
    userSalesPast30Days: { 'Eva': 0, 'Yo': 0, 'Katie': 0, 'Kasey': 0 },
  };

  data.forEach(item => {
    analytics.totalSales += item.sales;
    analytics.totalProfit += item.profit;
    
    if (item.category) {
      analytics.salesByCategory[item.category] = (analytics.salesByCategory[item.category] || 0) + item.sales;
    }
    if (item.region) {
      analytics.salesByRegion[item.region] = (analytics.salesByRegion[item.region] || 0) + item.sales;
    }
    
    const date = new Date(item.orderDate);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      analytics.salesByMonth[monthYear] = (analytics.salesByMonth[monthYear] || 0) + item.sales;
      
      const dayKey = date.toISOString().split('T')[0];
      analytics.salesByDay[dayKey] = (analytics.salesByDay[dayKey] || 0) + item.subtotal;

      // Calculate User Performance for Eva, Yo, Katie, Kasey
      const normalized = normalizeUser(item.userName);
      if (normalized) {
        if (date >= sevenDaysAgo) {
          analytics.userSalesPastWeek[normalized] = (analytics.userSalesPastWeek[normalized] || 0) + item.subtotal;
        }
        if (date >= thirtyDaysAgo) {
          analytics.userSalesPast30Days[normalized] = (analytics.userSalesPast30Days[normalized] || 0) + item.subtotal;
        }
      }
    }
  });

  analytics.averageOrderValue = analytics.totalOrders > 0 ? analytics.totalSales / analytics.totalOrders : 0;
  return analytics;
};
