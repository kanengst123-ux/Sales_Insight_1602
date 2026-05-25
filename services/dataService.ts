
import { SaleRecord, SalesAnalytics, SalesData, Product, Customer } from '../types';

const DEFAULT_SHEET_ID = '10gGU4ZZH_qUKwYklfIK0sQFNCUCfUc36C3SpkfUoQlA';
export const UPDATE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxTE_vzsW_PgC0exqDDafe34ahEDZ2sdy1APO0Kywh8bm3kvDuD5Lo76J9B-xorUSQKRw/exec';

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
  const normalizedHeaders = headers.map(h => h?.toLowerCase().trim() || '');
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase().trim();
    const idx = normalizedHeaders.findIndex(h => h.includes(kw));
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

export const fetchCustomerGrades = async (): Promise<Customer[]> => {
  const URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vStdyv4mUaIdO-jPeUwBfxMxBZbCkbNEtk8VNhyrpiAInlNb7w3jli2jYtERyVPp94aWMeVuP4N0XNv/pub?gid=1793390915&single=true&output=csv';
  const cacheBuster = `&t=${Date.now()}`;
  try {
    const response = await fetch(URL + cacheBuster);
    if (!response.ok) throw new Error('Failed to fetch customer grades');
    const text = await response.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      name: row[0] || '',
      sales: row[1] || '',
      grade: (row[2] || 'C') as 'A' | 'B' | 'C',
      district: row[3] || ''
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
    orderId: findColumn(headers, ['orderid', 'id', 'ref', 'invoice']),
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

export const fetchProducts = async (customId?: string): Promise<Product[]> => {
  const MASTER_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vStdyv4mUaIdO-jPeUwBfxMxBZbCkbNEtk8VNhyrpiAInlNb7w3jli2jYtERyVPp94aWMeVuP4N0XNv/pub?gid=687938954&single=true&output=csv';
  
  try {
    const response = await fetch(MASTER_URL + `&t=${Date.now()}`);
    if (!response.ok) throw new Error('Master sheet fetch failed');
    const text = await response.text();
    const rows = parseCSV(text);
    if (rows.length < 1) return [];
    
    // Find the header row (usually 0, but scan just in case)
    let headerRowIdx = 0;
    let titleIdx = 2; // Col C is Title
    let goldIdx = 17; // Col R
    let silverIdx = 18; // Col S
    let basicIdx = 19; // Col T
    let priceIdx = 14; // Col O
    let discountedPriceIdx = 15; // Col P
    
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const idx = rows[i].findIndex(cell => cell && cell.toLowerCase().trim() === 'title');
      if (idx !== -1) {
        headerRowIdx = i;
        titleIdx = idx;
        // Verify other indices based on actual headers if possible
        const rIdx = rows[i].findIndex(cell => cell && cell.toLowerCase().includes('gold'));
        if (rIdx !== -1) goldIdx = rIdx;
        const sIdx = rows[i].findIndex(cell => cell && cell.toLowerCase().includes('silver'));
        if (sIdx !== -1) silverIdx = sIdx;
        const tIdx = rows[i].findIndex(cell => cell && cell.toLowerCase().includes('basic'));
        if (tIdx !== -1) basicIdx = tIdx;
        const pIdx = rows[i].findIndex(cell => cell && cell.toLowerCase().trim() === 'price');
        if (pIdx !== -1) priceIdx = pIdx;
        const dpIdx = rows[i].findIndex(cell => cell && cell.toLowerCase().trim() === 'discounted price');
        if (dpIdx !== -1) discountedPriceIdx = dpIdx;
        break;
      }
    }

    const productMap = new Map<string, Product>();
    rows.slice(headerRowIdx + 1).forEach(row => {
      const productName = row[titleIdx];
      if (productName && productName.trim()) {
        const trimmed = productName.trim();
        // Skip header if it repeated or invalid titles
        if (trimmed.toLowerCase() === 'title') return;
        
        const getPrice = (idx: number) => {
          const val = row[idx];
          if (val && val.trim() !== '') return parseNum(val);
          
          const discounted = row[discountedPriceIdx];
          if (discounted && discounted.trim() !== '') return parseNum(discounted);
          
          return parseNum(row[priceIdx]);
        };

        // Filter out very short or numeric-only strings if they aren't products
        if (trimmed.length > 1) {
          if (!productMap.has(trimmed)) {
            productMap.set(trimmed, {
              name: trimmed,
              prices: {
                A: getPrice(goldIdx),
                B: getPrice(silverIdx),
                C: getPrice(basicIdx)
              }
            });
          }
        }
      }
    });
    
    return Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
};

export const addCustomerToSheet = async (name: string, user: string, district: string, grade: 'A' | 'B' | 'C'): Promise<boolean> => {
  try {
    // Title case the user (EVA -> Eva, etc.)
    const formattedUser = user.charAt(0).toUpperCase() + user.slice(1).toLowerCase();
    const payload = {
      action: 'addCustomer',
      name,
      user: formattedUser,
      district,
      grade
    };
    await fetch(UPDATE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (error) {
    console.error('Error adding customer:', error);
    return false;
  }
};

export const addProductToSheet = async (name: string, username: string): Promise<boolean> => {
  try {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ddmmyyyyhhmmss = `${dd}${mm}${yyyy}${hh}${min}${ss}`;
    const generatedId = `${username}${ddmmyyyyhhmmss}`;

    const payload = {
      action: 'addProduct',
      name,
      username,
      id: generatedId
    };
    await fetch(UPDATE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (error) {
    console.error('Error adding product:', error);
    return false;
  }
};

export const writeTradeLogToSheet = async (rows: any[][]): Promise<boolean> => {
  try {
    const payload = {
      action: 'writeTradeLog',
      rows
    };
    await fetch(UPDATE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (error) {
    console.error('Error writing trade log:', error);
    return false;
  }
};

