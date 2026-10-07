"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminShippingOrder } from "../../lib/admin-dashboard-types";

const statusLabels: Record<string, string> = {
  pending: "Ödeme bekliyor",
  paid: "Hazırlanacak",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  failed: "Başarısız",
  cancelled: "İptal",
};

const channelLabels: Record<AdminShippingOrder["salesChannel"], string> = {
  "terragolds.com": "Site",
  trendyol: "Trendyol",
  hepsiburada: "Hepsiburada",
  n11: "N11",
};

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function formatAmount(cents: number) {
  return money.format(cents / 100);
}

export default function OrdersPanel({
  onNavigateShipping,
}: {
  onNavigateShipping: () => void;
}) {
  const [orders, setOrders] = useState<AdminShippingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/shipping", {
          cache: "no-store",
        });
        const body = (await response.json()) as {
          orders?: AdminShippingOrder[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "Siparişler alınamadı.");
        if (active) setOrders(body.orders ?? []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Siparişler alınamadı.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (channelFilter !== "all" && order.salesChannel !== channelFilter) {
        return false;
      }
      if (!query) return true;
      return (
        order.id.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.email.toLowerCase().includes(query)
      );
    });
  }, [orders, search, statusFilter, channelFilter]);

  return (
    <div className="admin-discounts">
      <section className="admin-discount-hero">
        <div>
          <p className="admin-kicker">Tüm siparişler</p>
          <h2>Site ve pazaryeri siparişlerini tek yerden arayın.</h2>
          <p>
            Durum, kanal ve müşteriye göre filtreleyin. Kargo bilgisi
            düzenlemek için Kargo ekranına geçin.
          </p>
        </div>
        <button className="admin-secondary-button" type="button" onClick={onNavigateShipping}>
          Kargo ekranına git →
        </button>
      </section>

      <div className="admin-field-grid" style={{ marginBottom: 16 }}>
        <label className="admin-field">
          <span>Ara</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sipariş no, müşteri adı veya e-posta"
          />
        </label>
        <label className="admin-field">
          <span>Durum</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Tümü</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Kanal</span>
          <select
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value)}
          >
            <option value="all">Tümü</option>
            {Object.entries(channelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="admin-alert error" role="alert">
          <span>!</span>
          <p>{error}</p>
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <span />
          <p>Siparişler hazırlanıyor…</p>
        </div>
      ) : filtered.length ? (
        <div className="admin-discount-list">
          {filtered.map((order) => (
            <article key={`${order.salesChannel}-${order.id}`}>
              <div className="admin-discount-code">
                <strong>{order.id}</strong>
                <span className="discount-state">
                  {channelLabels[order.salesChannel]}
                </span>
              </div>
              <div>
                <b>{order.customerName}</b>
                <small>{order.email}</small>
              </div>
              <div>
                <b>{formatAmount(order.totalAmount)}</b>
                <small>{statusLabels[order.status] ?? order.status}</small>
              </div>
              <div>
                <small>
                  {new Date(order.createdAt).toLocaleDateString("tr-TR")}
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty">
          <span>⌕</span>
          <h2>Sonuç bulunamadı</h2>
          <p>Filtreleri değiştirip tekrar deneyin.</p>
        </div>
      )}
    </div>
  );
}
