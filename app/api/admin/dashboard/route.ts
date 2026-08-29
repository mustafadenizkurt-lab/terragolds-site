import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import type {
  AdminDashboardData,
  DashboardPeriod,
} from "../../../../lib/admin-dashboard-types";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

type SummaryRow = {
  total_orders: number;
  paid_orders: number;
  revenue: number;
  discount_amount: number;
  shipping_amount: number;
  failed_orders: number;
  cancelled_orders: number;
};

const periodLabels: Record<DashboardPeriod, string> = {
  day: "Günlük",
  week: "Haftalık",
  month: "Aylık",
  year: "Yıllık",
};

function isDashboardPeriod(value: string): value is DashboardPeriod {
  return ["day", "week", "month", "year"].includes(value);
}

function startOfUtcDay(value: Date) {
  const result = new Date(value);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function addUtcDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addUtcMonths(value: Date, months: number) {
  const result = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1),
  );
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function formatRange(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: start.getUTCFullYear() === end.getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function createPeriod(period: DashboardPeriod) {
  const now = new Date();
  const today = startOfUtcDay(now);
  let currentStart = today;
  let previousStart = addUtcDays(today, -1);

  if (period === "week") {
    currentStart = addUtcDays(today, -6);
    previousStart = addUtcDays(currentStart, -7);
  } else if (period === "month") {
    currentStart = addUtcDays(today, -29);
    previousStart = addUtcDays(currentStart, -30);
  } else if (period === "year") {
    currentStart = addUtcMonths(today, -11);
    previousStart = addUtcMonths(currentStart, -12);
  }

  return {
    key: period,
    label: periodLabels[period],
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd: currentStart,
    rangeLabel:
      period === "day" ? "Bugün" : formatRange(currentStart, now),
    previousRangeLabel:
      period === "day"
        ? "Dün"
        : formatRange(previousStart, addUtcDays(currentStart, -1)),
  };
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function normalizeSummary(row: SummaryRow | null) {
  const totalOrders = Number(row?.total_orders) || 0;
  const paidOrders = Number(row?.paid_orders) || 0;
  const revenue = Number(row?.revenue) || 0;
  return {
    totalOrders,
    paidOrders,
    revenue,
    discountAmount: Number(row?.discount_amount) || 0,
    shippingAmount: Number(row?.shipping_amount) || 0,
    failedOrders: Number(row?.failed_orders) || 0,
    cancelledOrders: Number(row?.cancelled_orders) || 0,
    averageOrderValue: paidOrders ? Math.round(revenue / paidOrders) : 0,
    paidRate: totalOrders
      ? Math.round((paidOrders / totalOrders) * 1000) / 10
      : 0,
  };
}

function buildSalesSeries(
  period: ReturnType<typeof createPeriod>,
  rows: Array<{ bucket: string; orders: number; revenue: number }>,
) {
  const values = new Map(
    rows.map((row) => [
      row.bucket,
      {
        orders: Number(row.orders) || 0,
        revenue: Number(row.revenue) || 0,
      },
    ]),
  );

  if (period.key === "day") {
    return Array.from({ length: 8 }, (_, index) => {
      const hour = index * 3;
      const bucket = String(hour).padStart(2, "0");
      return {
        date: `${period.currentStart.toISOString().slice(0, 10)}T${bucket}:00`,
        label: `${bucket}–${String(hour + 3).padStart(2, "0")}`,
        ...(values.get(bucket) ?? { revenue: 0, orders: 0 }),
      };
    });
  }

  if (period.key === "year") {
    return Array.from({ length: 12 }, (_, index) => {
      const date = addUtcMonths(period.currentStart, index);
      const bucket = date.toISOString().slice(0, 7);
      return {
        date: bucket,
        label: date.toLocaleDateString("tr-TR", {
          month: "short",
          timeZone: "UTC",
        }),
        ...(values.get(bucket) ?? { revenue: 0, orders: 0 }),
      };
    });
  }

  const length = period.key === "week" ? 7 : 30;
  return Array.from({ length }, (_, index) => {
    const date = addUtcDays(period.currentStart, index);
    const bucket = date.toISOString().slice(0, 10);
    return {
      date: bucket,
      label: date.toLocaleDateString("tr-TR", {
        day: period.key === "month" ? "2-digit" : undefined,
        month: period.key === "month" ? "short" : undefined,
        weekday: period.key === "week" ? "short" : undefined,
        timeZone: "UTC",
      }),
      ...(values.get(bucket) ?? { revenue: 0, orders: 0 }),
    };
  });
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const requestedPeriod = new URL(request.url).searchParams.get("period") ?? "";
    const period = createPeriod(
      isDashboardPeriod(requestedPeriod) ? requestedPeriod : "week",
    );
    const db = getD1();
    const currentStart = period.currentStart.toISOString();
    const currentEnd = period.currentEnd.toISOString();
    const previousStart = period.previousStart.toISOString();
    const previousEnd = period.previousEnd.toISOString();
    const activityTime = "COALESCE(paid_at, created_at)";
    const salesBucket =
      period.key === "day"
        ? `printf('%02d', (CAST(strftime('%H', ${activityTime}) AS INTEGER) / 3) * 3)`
        : period.key === "year"
          ? `substr(${activityTime}, 1, 7)`
          : `substr(${activityTime}, 1, 10)`;

    const summaryStatement = `SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'shipped', 'delivered') THEN 1 ELSE 0 END), 0) AS paid_orders,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'shipped', 'delivered') THEN total_amount ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'shipped', 'delivered') THEN discount_amount ELSE 0 END), 0) AS discount_amount,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'shipped', 'delivered') THEN shipping_amount ELSE 0 END), 0) AS shipping_amount,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_orders,
        COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_orders
      FROM orders
      WHERE datetime(${activityTime}) >= datetime(?)
        AND datetime(${activityTime}) < datetime(?)`;

    const [
      currentSummaryRow,
      previousSummaryRow,
      operations,
      inventory,
      itemsSold,
      profit,
      todayRevenue,
      sales,
      statuses,
      lowStock,
      favorites,
      recentOrders,
    ] = await Promise.all([
      db
        .prepare(summaryStatement)
        .bind(currentStart, currentEnd)
        .first<SummaryRow>(),
      db
        .prepare(summaryStatement)
        .bind(previousStart, previousEnd)
        .first<SummaryRow>(),
      db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) AS awaiting_shipment,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_payment
           FROM orders`,
        )
        .first<{ awaiting_shipment: number; pending_payment: number }>(),
      db
        .prepare(
          `SELECT
             COALESCE(SUM(stock), 0) AS total_units,
             COALESCE(SUM(CASE WHEN stock > 3 THEN 1 ELSE 0 END), 0) AS healthy_products,
             COALESCE(SUM(CASE WHEN stock BETWEEN 1 AND 3 THEN 1 ELSE 0 END), 0) AS low_stock_products,
             COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_products,
             COALESCE(SUM(
               ROUND(stock * price * (100 - discount_percent) / 100.0)
             ), 0) AS inventory_value
           FROM products`,
        )
        .first<{
          total_units: number;
          healthy_products: number;
          low_stock_products: number;
          out_of_stock_products: number;
          inventory_value: number;
        }>(),
      db
        .prepare(
          `SELECT COALESCE(SUM(order_items.quantity), 0) AS items_sold
           FROM order_items
           INNER JOIN orders ON orders.id = order_items.order_id
           WHERE orders.status IN ('paid', 'shipped', 'delivered')
             AND datetime(COALESCE(orders.paid_at, orders.created_at)) >= datetime(?)
             AND datetime(COALESCE(orders.paid_at, orders.created_at)) < datetime(?)`,
        )
        .bind(currentStart, currentEnd)
        .first<{ items_sold: number }>(),
      db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN products.cost > 0 THEN order_items.quantity * order_items.unit_price ELSE 0 END), 0) AS revenue_with_cost,
             COALESCE(SUM(CASE WHEN products.cost > 0 THEN order_items.quantity * products.cost * 100 ELSE 0 END), 0) AS cost_of_goods,
             COALESCE(SUM(CASE WHEN products.cost > 0 THEN order_items.quantity ELSE 0 END), 0) AS items_with_cost
           FROM order_items
           INNER JOIN orders ON orders.id = order_items.order_id
           LEFT JOIN products ON products.id = order_items.product_id
           WHERE orders.status IN ('paid', 'shipped', 'delivered')
             AND datetime(COALESCE(orders.paid_at, orders.created_at)) >= datetime(?)
             AND datetime(COALESCE(orders.paid_at, orders.created_at)) < datetime(?)`,
        )
        .bind(currentStart, currentEnd)
        .first<{
          revenue_with_cost: number;
          cost_of_goods: number;
          items_with_cost: number;
        }>(),
      db
        .prepare(
          `SELECT COALESCE(SUM(total_amount), 0) AS revenue
           FROM orders
           WHERE status IN ('paid', 'shipped', 'delivered')
             AND date(${activityTime}) = date('now')`,
        )
        .first<{ revenue: number }>(),
      db
        .prepare(
          `SELECT ${salesBucket} AS bucket,
                  COUNT(*) AS orders,
                  COALESCE(SUM(total_amount), 0) AS revenue
           FROM orders
           WHERE status IN ('paid', 'shipped', 'delivered')
             AND datetime(${activityTime}) >= datetime(?)
             AND datetime(${activityTime}) < datetime(?)
           GROUP BY bucket
           ORDER BY bucket`,
        )
        .bind(currentStart, currentEnd)
        .all<{ bucket: string; orders: number; revenue: number }>(),
      db
        .prepare(
          `SELECT status, COUNT(*) AS count
           FROM orders
           WHERE datetime(${activityTime}) >= datetime(?)
             AND datetime(${activityTime}) < datetime(?)
           GROUP BY status
           ORDER BY count DESC`,
        )
        .bind(currentStart, currentEnd)
        .all<{ status: string; count: number }>(),
      db
        .prepare(
          `SELECT id, name, image, stock
           FROM products
           WHERE stock <= 3
           ORDER BY stock ASC, updated_at DESC
           LIMIT 8`,
        )
        .all<{ id: number; name: string; image: string; stock: number }>(),
      db
        .prepare(
          `SELECT products.id, products.name, products.image,
                  COUNT(product_favorites.id) AS favorites
           FROM products
           LEFT JOIN product_favorites
             ON product_favorites.product_id = products.id
           GROUP BY products.id
           HAVING COUNT(product_favorites.id) > 0
           ORDER BY favorites DESC, products.updated_at DESC
           LIMIT 6`,
        )
        .all<{
          id: number;
          name: string;
          image: string;
          favorites: number;
        }>(),
      db
        .prepare(
          `SELECT id, customer_first_name, customer_last_name,
                  status, total_amount, created_at
           FROM orders
           WHERE datetime(${activityTime}) >= datetime(?)
             AND datetime(${activityTime}) < datetime(?)
           ORDER BY created_at DESC
           LIMIT 8`,
        )
        .bind(currentStart, currentEnd)
        .all<{
          id: string;
          customer_first_name: string;
          customer_last_name: string;
          status: string;
          total_amount: number;
          created_at: string;
        }>(),
    ]);

    const current = normalizeSummary(currentSummaryRow);
    const previous = normalizeSummary(previousSummaryRow);
    const inventorySummary = inventory ?? {
      total_units: 0,
      healthy_products: 0,
      low_stock_products: 0,
      out_of_stock_products: 0,
      inventory_value: 0,
    };

    const dashboard: AdminDashboardData = {
      period: {
        key: period.key,
        label: period.label,
        rangeLabel: period.rangeLabel,
        previousRangeLabel: period.previousRangeLabel,
      },
      summary: {
        ...current,
        awaitingShipment: Number(operations?.awaiting_shipment) || 0,
        pendingPayment: Number(operations?.pending_payment) || 0,
        todayRevenue: Number(todayRevenue?.revenue) || 0,
        inventoryValue: Number(inventorySummary.inventory_value) || 0,
        itemsSold: Number(itemsSold?.items_sold) || 0,
        estimatedProfit:
          (Number(profit?.revenue_with_cost) || 0) -
          (Number(profit?.cost_of_goods) || 0),
        costCoveragePercent: itemsSold?.items_sold
          ? Math.round(
              ((Number(profit?.items_with_cost) || 0) /
                Number(itemsSold.items_sold)) *
                100,
            )
          : 0,
      },
      comparison: {
        revenueChange: percentChange(current.revenue, previous.revenue),
        ordersChange: percentChange(
          current.totalOrders,
          previous.totalOrders,
        ),
        averageOrderValueChange: percentChange(
          current.averageOrderValue,
          previous.averageOrderValue,
        ),
        paidRateChange:
          Math.round((current.paidRate - previous.paidRate) * 10) / 10,
      },
      stock: {
        totalUnits: Number(inventorySummary.total_units) || 0,
        healthyProducts: Number(inventorySummary.healthy_products) || 0,
        lowStockProducts: Number(inventorySummary.low_stock_products) || 0,
        outOfStockProducts:
          Number(inventorySummary.out_of_stock_products) || 0,
      },
      salesByDay: buildSalesSeries(period, sales.results),
      statusBreakdown: statuses.results.map((row) => ({
        status: row.status,
        count: Number(row.count) || 0,
      })),
      lowStockProducts: lowStock.results.map((product) => ({
        ...product,
        stock: Number(product.stock) || 0,
      })),
      favoriteProducts: favorites.results.map((product) => ({
        ...product,
        favorites: Number(product.favorites) || 0,
      })),
      recentOrders: recentOrders.results.map((order) => ({
        id: order.id,
        customerName:
          `${order.customer_first_name} ${order.customer_last_name}`.trim(),
        status: order.status,
        totalAmount: Number(order.total_amount) || 0,
        createdAt: order.created_at,
      })),
    };

    return Response.json(
      { dashboard },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Yönetim özeti hazırlanamadı.",
      },
      { status: 500 },
    );
  }
}
