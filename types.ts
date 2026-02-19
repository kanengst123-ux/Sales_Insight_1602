
export interface SaleRecord extends Record<string, any> {
  orderId: string;
  orderDate: string;
  customerName: string;
  userName: string;
  segment: string;
  region: string;
  category: string;
  subCategory: string;
  productName: string;
  sales: number;
  quantity: number;
  profit: number;
  // Specific fields for collections and specialized tracking
  subtotal: number;
  paidStatus: string;
  paidDate: string;
  colSValue: string;
  countValue: number; // Derived from Column R
}

export interface SalesData {
  records: SaleRecord[];
  headers: string[];
}

export interface SalesAnalytics {
  totalSales: number;
  totalProfit: number;
  totalOrders: number;
  averageOrderValue: number;
  salesByCategory: Record<string, number>;
  salesByRegion: Record<string, number>;
  salesByMonth: Record<string, number>;
  salesByDay: Record<string, number>;
  userSalesPastWeek: Record<string, number>;
  userSalesPast30Days: Record<string, number>;
}

export interface InsightReport {
  summary: string;
  keyDrivers: string[];
  recommendations: string[];
}

export type PivotField = string;
export type PivotMetric = string;
export type SortOrder = 'alpha' | 'desc' | 'asc';

export interface PivotConfig {
  rowField: PivotField;
  colField: PivotField | 'none';
  metric: PivotMetric;
  sortOrder: SortOrder;
}
