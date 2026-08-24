"use client";

import type {
  AdminDashboardData,
  DashboardPeriod,
} from "../../lib/admin-dashboard-types";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const periods: Array<{ key: DashboardPeriod; label: string }> = [
  { key: "day", label: "Gün" },
  { key: "week", label: "Hafta" },
  { key: "month", label: "Ay" },
  { key: "year", label: "Yıl" },
];

function formatCents(value: number) {
  return money.format(value / 100);
}

export default function ReportsPanel({
  dashboard,
  loading,
  onPeriodChange,
}: {
  dashboard: AdminDashboardData | null;
  loading: boolean;
  onPeriodChange: (period: DashboardPeriod) => void;
}) {
  if (!dashboard) {
    return <div className="admin-empty small">Rapor verisi hazırlanıyor...</div>;
  }

  const maxRevenue = Math.max(
    1,
    ...dashboard.salesByDay.map((day) => day.revenue),
  );

  return (
    <div className={`admin-workbench${loading ? " loading" : ""}`}>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Analitik</p>
            <h2>Satış raporları</h2>
          </div>
          <div className="admin-segmented">
            {periods.map((period) => (
              <button
                type="button"
                key={period.key}
                className={dashboard.period.key === period.key ? "active" : ""}
                onClick={() => onPeriodChange(period.key)}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-report-metrics">
          <article>
            <span>Net satış</span>
            <strong>{formatCents(dashboard.summary.revenue)}</strong>
          </article>
          <article>
            <span>Sipariş</span>
            <strong>{dashboard.summary.totalOrders}</strong>
          </article>
          <article>
            <span>Ortalama sepet</span>
            <strong>{formatCents(dashboard.summary.averageOrderValue)}</strong>
          </article>
          <article>
            <span>Stok değeri</span>
            <strong>{formatCents(dashboard.summary.inventoryValue)}</strong>
          </article>
        </div>

        <div className="admin-report-chart">
          {dashboard.salesByDay.map((day) => (
            <div key={day.date}>
              <span style={{ height: `${Math.max(8, (day.revenue / maxRevenue) * 100)}%` }} />
              <small>{day.label}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-report-grid">
        <section className="admin-panel">
          <p className="admin-kicker">Sipariş durumları</p>
          <div className="admin-mini-list">
            {dashboard.statusBreakdown.map((item) => (
              <div key={item.status}>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <p className="admin-kicker">Favori ürünler</p>
          <div className="admin-mini-list">
            {dashboard.favoriteProducts.slice(0, 6).map((product) => (
              <div key={product.id}>
                <span>{product.name}</span>
                <strong>{product.favorites}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <p className="admin-kicker">Kritik stok</p>
          <div className="admin-mini-list">
            {dashboard.lowStockProducts.slice(0, 6).map((product) => (
              <div key={product.id}>
                <span>{product.name}</span>
                <strong>{product.stock}</strong>
              </div>
            ))}
            {dashboard.lowStockProducts.length === 0 && (
              <div>
                <span>Kritik stokta ürün yok</span>
                <strong>0</strong>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
