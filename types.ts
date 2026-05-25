
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
  unit: string;
  price: number;
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

export interface Product {
  name: string;
  price?: number;
  prices: {
    A: number;
    B: number;
    C: number;
  };
}

export interface Customer {
  name: string;
  grade: 'A' | 'B' | 'C';
  district?: string;
  sales: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number; // This is the value displayed in the input
  price: number;
  isOuterBox: boolean; // Toggle state
  unitsPerBox: number | null; // Extracted from name e.g. "6/箱" -> 6
  outerBoxUnit: string | null; // Extracted from name e.g. "6/箱" -> "箱", "10/條" -> "條"
}

export interface SavedOrder {
  id: string;
  date: string;
  customerName: string;
  orderAmount: number;
  salesName: string;
  remark: string;
  items: OrderItem[];
  isHeld?: boolean;
  isKeyedIn?: boolean;
}
