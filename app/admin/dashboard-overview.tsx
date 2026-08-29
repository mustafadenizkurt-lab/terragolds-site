"use client";

import type { CSSProperties } from "react";
import type {
  AdminDashboardData,
  DashboardPeriod,
} from "../../lib/admin-dashboard-types";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const statusMeta: Record<
  string,
  { label: string; color: string }
> = {
  pending: { label: "Ödeme bekliyor", color: "#caa264" },
  paid: { label: "Hazırlanacak", color: "#376b5b" },
  shipped: { label: "Kargoda", color: "#7c93a4" },
  delivered: { label: "Teslim edildi", color: "#5f8c72" },
  failed: { label: "Başarısız", color: "#b96b5b" },
  cancelled: { label: "İptal", color: "#a7a39a" },
};

function formatCents(value: number) {
  return currency.format(value / 100);
}

function shortOrderId(value: string) {
  return value.length > 13 ? `${value.slice(0, 7)}…${value.slice(-4)}` : value;
}

function Comparison({
  value,
  points = false,
}: {
  value: number;
  points?: boolean;
}) {
  const state = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  return (
    <small className={`admin-metric-comparison ${state}`}>
      {value > 0 ? "↑" : value < 0 ? "↓" : "—"}{" "}
      {value === 0 ? "Değişmedi" : `${Math.abs(value)} ${points ? "puan" : "%"}`}
    </small>
  );
}

const periods: Array<{ key: DashboardPeriod; label: string }> = [
  { key: "day", label: "Günlük" },
  { key: "week", label: "Haftalık" },
  { key: "month", label: "Aylık" },
  { key: "year", label: "Yıllık" },
];

export default function DashboardOverview({
  dashboard,
  loading,
  onPeriodChange,
  onResetPeriod,
  onOpenProduct,
  onNavigateProducts,
  onNavigateShipping,
}: {
  dashboard: AdminDashboardData;
  loading: boolean;
  onPeriodChange: (period: DashboardPeriod) => void;
  onResetPeriod: () => void;
  onOpenProduct: (productId: number) => void;
  onNavigateProducts: () => void;
  onNavigateShipping: () => void;
}) {
  const maxRevenue = Math.max(
    1,
    ...dashboard.salesByDay.map((day) => day.revenue),
  );
  const totalStatuses = Math.max(
    1,
    dashboard.statusBreakdown.reduce((total, item) => total + item.count, 0),
  );
  const statusSegments = dashboard.statusBreakdown.reduce<{
    angle: number;
    segments: string[];
  }>(
    (result, item) => {
      const end = result.angle + (item.count / totalStatuses) * 360;
      return {
        angle: end,
        segments: [
          ...result.segments,
          `${statusMeta[item.status]?.color ?? "#c7c4bc"} ${result.angle}deg ${end}deg`,
        ],
      };
    },
    { angle: 0, segments: [] },
  ).segments;
  const totalStockProducts = Math.max(
    1,
    dashboard.stock.healthyProducts +
      dashboard.stock.lowStockProducts +
      dashboard.stock.outOfStockProducts,
  );
  const maxFavorites = Math.max(
    1,
    ...dashboard.favoriteProducts.map((product) => product.favorites),
  );

  return (
    <div className={`admin-dashboard${loading ? " loading" : ""}`}>
      <section className="admin-dashboard-range">
        <div>
          <p className="admin-kicker">Raporlama dönemi</p>
          <h2>{dashboard.period.label} performans</h2>
          <span>
            {dashboard.period.rangeLabel} · Önceki dönem:{" "}
            {dashboard.period.previousRangeLabel}
          </span>
        </div>
        <div className="admin-period-controls">
          <div role="group" aria-label="Raporlama dönemi">
            {periods.map((period) => (
              <button
                type="button"
                className={
                  dashboard.period.key === period.key ? "active" : ""
                }
                disabled={loading}
                onClick={() => onPeriodChange(period.key)}
                key={period.key}
              >
                {period.label}
              </button>
            ))}
          </div>
          <button
            className="admin-period-reset"
            type="button"
            disabled={loading}
            onClick={onResetPeriod}
          >
            ↺ Sıfırla
          </button>
        </div>
      </section>

      {(dashboard.summary.awaitingShipment > 0 ||
        dashboard.summary.pendingPayment > 0 ||
        dashboard.stock.lowStockProducts > 0 ||
        dashboard.stock.outOfStockProducts > 0) && (
        <section className="admin-attention-strip">
          <div>
            <span>Bugün ilgilenmeniz gerekenler</span>
            <strong>
              {dashboard.summary.awaitingShipment} hazırlanacak sipariş ·{" "}
              {dashboard.summary.pendingPayment} ödeme bekliyor ·{" "}
              {dashboard.stock.lowStockProducts} düşük stok ·{" "}
              {dashboard.stock.outOfStockProducts} tükenen ürün
            </strong>
          </div>
          <button type="button" onClick={onNavigateShipping}>
            Kargo ekranına git →
          </button>
        </section>
      )}

      <section className="admin-dashboard-metrics">
        <article>
          <span>Dönem net satışı</span>
          <strong>{formatCents(dashboard.summary.revenue)}</strong>
          <Comparison value={dashboard.comparison.revenueChange} />
        </article>
        <article>
          <span>Toplam sipariş</span>
          <strong>{dashboard.summary.totalOrders}</strong>
          <Comparison value={dashboard.comparison.ordersChange} />
        </article>
        <article>
          <span>Ortalama sepet</span>
          <strong>{formatCents(dashboard.summary.averageOrderValue)}</strong>
          <Comparison value={dashboard.comparison.averageOrderValueChange} />
        </article>
        <article>
          <span>Başarılı ödeme oranı</span>
          <strong>%{dashboard.summary.paidRate}</strong>
          <Comparison value={dashboard.comparison.paidRateChange} points />
        </article>
        <article>
          <span>Satılan ürün adedi</span>
          <strong>{dashboard.summary.itemsSold}</strong>
          <small>{dashboard.summary.paidOrders} başarılı sipariş</small>
        </article>
        <article>
          <span>Tahmini kâr</span>
          <strong>{formatCents(dashboard.summary.estimatedProfit)}</strong>
          <small>
            {dashboard.summary.costCoveragePercent > 0
              ? `Satılan ürünlerin %${dashboard.summary.costCoveragePercent}'i için maliyet verisi var`
              : "Ürünlerde maliyet girilmemiş, tahmin yapılamıyor"}
          </small>
        </article>
        <article>
          <span>Uygulanan indirim</span>
          <strong>{formatCents(dashboard.summary.discountAmount)}</strong>
          <small>Dönemde kullanılan toplam avantaj</small>
        </article>
        <article>
          <span>Kargo geliri</span>
          <strong>{formatCents(dashboard.summary.shippingAmount)}</strong>
          <small>Ücretli gönderimlerden elde edilen</small>
        </article>
        <article className={dashboard.summary.awaitingShipment ? "attention" : ""}>
          <span>Hazırlanacak sipariş</span>
          <strong>{dashboard.summary.awaitingShipment}</strong>
          <small>Şu anda kargoya verilmeyi bekliyor</small>
        </article>
      </section>

      <div className="admin-analytics-grid">
        <section className="admin-analytics-card sales">
          <header>
            <div>
              <p className="admin-kicker">{dashboard.period.rangeLabel}</p>
              <h2>Satış ve gelir</h2>
            </div>
            <span>
              {dashboard.summary.paidOrders} başarılı ·{" "}
              {dashboard.summary.failedOrders} başarısız ·{" "}
              {dashboard.summary.cancelledOrders} iptal
            </span>
          </header>
          <div
            className="admin-sales-chart"
            aria-label={`${dashboard.period.label} gelir grafiği`}
            style={
              {
                "--series-count": dashboard.salesByDay.length,
              } as CSSProperties
            }
          >
            {dashboard.salesByDay.map((day) => (
              <div className="admin-sales-day" key={day.date}>
                <div>
                  <span
                    style={
                      {
                        "--bar-height": `${Math.max(
                          day.revenue > 0 ? 9 : 2,
                          (day.revenue / maxRevenue) * 100,
                        )}%`,
                      } as CSSProperties
                    }
                  />
                </div>
                <strong>{day.label}</strong>
                <small>{day.orders} sipariş</small>
                <b>{formatCents(day.revenue)}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-analytics-card order-status">
          <header>
            <div>
              <p className="admin-kicker">Sipariş akışı</p>
              <h2>Durum dağılımı</h2>
            </div>
          </header>
          <div className="admin-status-summary">
            <div
              className="admin-status-ring"
              style={{
                background: statusSegments.length
                  ? `conic-gradient(${statusSegments.join(",")})`
                  : "#ece8df",
              }}
              aria-hidden="true"
            >
              <span>
                <strong>{dashboard.summary.totalOrders}</strong>
                <small>Sipariş</small>
              </span>
            </div>
            <div className="admin-status-legend">
              {dashboard.statusBreakdown.map((item) => (
                <div key={item.status}>
                  <i
                    style={{
                      background: statusMeta[item.status]?.color ?? "#c7c4bc",
                    }}
                  />
                  <span>{statusMeta[item.status]?.label ?? item.status}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {!dashboard.statusBreakdown.length && (
                <p>Henüz sipariş kaydı bulunmuyor.</p>
              )}
            </div>
          </div>
        </section>

        <section className="admin-analytics-card stock">
          <header>
            <div>
              <p className="admin-kicker">Envanter</p>
              <h2>Stok durumu</h2>
            </div>
            <button type="button" onClick={onNavigateProducts}>
              Ürünlere git
            </button>
          </header>
          <div className="admin-stock-totals">
            <div>
              <strong>{dashboard.stock.totalUnits}</strong>
              <span>Toplam adet</span>
            </div>
            <div>
              <strong>{currency.format(dashboard.summary.inventoryValue)}</strong>
              <span>Stok satış değeri</span>
            </div>
          </div>
          <div className="admin-stock-distribution" aria-label="Stok dağılımı">
            <span
              className="healthy"
              style={{
                width: `${(dashboard.stock.healthyProducts / totalStockProducts) * 100}%`,
              }}
            />
            <span
              className="low"
              style={{
                width: `${(dashboard.stock.lowStockProducts / totalStockProducts) * 100}%`,
              }}
            />
            <span
              className="empty"
              style={{
                width: `${(dashboard.stock.outOfStockProducts / totalStockProducts) * 100}%`,
              }}
            />
          </div>
          <div className="admin-stock-labels">
            <span><i className="healthy" />Yeterli {dashboard.stock.healthyProducts}</span>
            <span><i className="low" />Azalan {dashboard.stock.lowStockProducts}</span>
            <span><i className="empty" />Tükenen {dashboard.stock.outOfStockProducts}</span>
          </div>
          <div className="admin-low-stock-list">
            {dashboard.lowStockProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => onOpenProduct(product.id)}
              >
                <img src={product.image} alt="" />
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    {product.stock === 0
                      ? "Stok tükendi"
                      : `Son ${product.stock} adet`}
                  </small>
                </span>
                <b>Güncelle →</b>
              </button>
            ))}
            {!dashboard.lowStockProducts.length && (
              <p className="admin-data-empty">Düşük stok uyarısı bulunmuyor.</p>
            )}
          </div>
        </section>

        <section className="admin-analytics-card favorites">
          <header>
            <div>
              <p className="admin-kicker">Müşteri ilgisi</p>
              <h2>En çok favorilenenler</h2>
            </div>
          </header>
          <div className="admin-favorite-ranking">
            {dashboard.favoriteProducts.map((product, index) => (
              <button
                type="button"
                key={product.id}
                onClick={() => onOpenProduct(product.id)}
              >
                <em>{String(index + 1).padStart(2, "0")}</em>
                <img src={product.image} alt="" />
                <span>
                  <strong>{product.name}</strong>
                  <i>
                    <b
                      style={{
                        width: `${(product.favorites / maxFavorites) * 100}%`,
                      }}
                    />
                  </i>
                </span>
                <small>{product.favorites} favori</small>
              </button>
            ))}
            {!dashboard.favoriteProducts.length && (
              <p className="admin-data-empty">Favori verisi henüz oluşmadı.</p>
            )}
          </div>
        </section>
      </div>

      <section className="admin-analytics-card recent-orders">
        <header>
          <div>
            <p className="admin-kicker">{dashboard.period.rangeLabel}</p>
            <h2>Son siparişler</h2>
          </div>
          <button type="button" onClick={onNavigateShipping}>
            Tüm kargo kayıtları
          </button>
        </header>
        <div className="admin-order-table">
          <div className="admin-order-table-head">
            <span>Sipariş</span>
            <span>Müşteri</span>
            <span>Tarih</span>
            <span>Durum</span>
            <span>Tutar</span>
          </div>
          {dashboard.recentOrders.map((order) => (
            <button
              type="button"
              key={order.id}
              onClick={onNavigateShipping}
            >
              <strong title={order.id}>{shortOrderId(order.id)}</strong>
              <span>{order.customerName}</span>
              <span>{new Date(order.createdAt).toLocaleDateString("tr-TR")}</span>
              <em className={`admin-order-state ${order.status}`}>
                {statusMeta[order.status]?.label ?? order.status}
              </em>
              <b>{formatCents(order.totalAmount)}</b>
            </button>
          ))}
          {!dashboard.recentOrders.length && (
            <p className="admin-data-empty">Henüz sipariş kaydı bulunmuyor.</p>
          )}
        </div>
      </section>
    </div>
  );
}
