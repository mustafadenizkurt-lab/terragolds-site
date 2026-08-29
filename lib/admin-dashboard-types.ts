export type DashboardPeriod = "day" | "week" | "month" | "year";

export type AdminDashboardData = {
  period: {
    key: DashboardPeriod;
    label: string;
    rangeLabel: string;
    previousRangeLabel: string;
  };
  summary: {
    totalOrders: number;
    paidOrders: number;
    awaitingShipment: number;
    pendingPayment: number;
    revenue: number;
    todayRevenue: number;
    averageOrderValue: number;
    inventoryValue: number;
    discountAmount: number;
    shippingAmount: number;
    itemsSold: number;
    paidRate: number;
    failedOrders: number;
    cancelledOrders: number;
    /** Revenue minus cost, computed only over items whose product has a known cost. */
    estimatedProfit: number;
    /** % of sold items (this period) that had a known cost — how trustworthy estimatedProfit is. */
    costCoveragePercent: number;
  };
  comparison: {
    revenueChange: number;
    ordersChange: number;
    averageOrderValueChange: number;
    paidRateChange: number;
  };
  stock: {
    totalUnits: number;
    healthyProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
  };
  salesByDay: Array<{
    date: string;
    label: string;
    revenue: number;
    orders: number;
  }>;
  statusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  lowStockProducts: Array<{
    id: number;
    name: string;
    image: string;
    stock: number;
  }>;
  favoriteProducts: Array<{
    id: number;
    name: string;
    image: string;
    favorites: number;
  }>;
  recentOrders: Array<{
    id: string;
    customerName: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
};

export type AdminShippingOrder = {
  id: string;
  status: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  discountCode: string | null;
  totalAmount: number;
  currency: string;
  paymentProvider: string;
  customerNote: string;
  shippingCarrier: string;
  trackingNumber: string;
  trackingUrl: string;
  autoDeliverAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
};
