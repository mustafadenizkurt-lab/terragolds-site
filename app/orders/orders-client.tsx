"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";
import StoreSiteFooter from "../store-site-footer";

type Order = {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  paymentId: string | null;
  address: string;
  createdAt: string;
  items: {
    productId: number | null;
    name: string;
    unitPrice: number;
    quantity: number;
  }[];
};

const statusLabels: Record<string, string> = {
  pending: "Ödeme bekliyor",
  paid: "Ödendi",
  failed: "Ödeme başarısız",
  shipped: "Kargoya verildi",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
};

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

export default function OrdersClient({
  businessName,
  businessAddress,
}: {
  businessName?: string;
  businessAddress?: string;
} = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/account/orders", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return null;
        }
        const body = (await response.json()) as {
          orders?: Order[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error);
        return body.orders ?? [];
      })
      .then((items) => {
        if (items) setOrders(items);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Siparişler alınamadı.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="profile-page">
      <StoreSubpageHeader />
      <section className="profile-content">
        <div className="profile-title">
          <p>Sipariş geçmişi</p>
          <h1>Siparişlerim</h1>
          <span>
            Ödeme ve teslimat durumlarını buradan takip edebilirsiniz.
          </span>
        </div>

        {loading ? (
          <div className="profile-loading">Siparişleriniz hazırlanıyor…</div>
        ) : error ? (
          <div className="profile-loading">{error}</div>
        ) : orders.length === 0 ? (
          <div className="orders-empty">
            <span>◇</span>
            <h2>Henüz siparişiniz yok</h2>
            <p>Koleksiyondaki benzersiz parçaları keşfedin.</p>
            <Link href="/#shop">Koleksiyona git</Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <header>
                  <div>
                    <span>Sipariş</span>
                    <strong>{order.id}</strong>
                  </div>
                  <div>
                    <span>Tarih</span>
                    <strong>
                      {new Date(order.createdAt).toLocaleDateString("tr-TR")}
                    </strong>
                  </div>
                  <div>
                    <span>Toplam</span>
                    <strong>{money.format(order.totalAmount / 100)}</strong>
                  </div>
                  <b className={`order-status ${order.status}`}>
                    {statusLabels[order.status] ?? order.status}
                  </b>
                </header>
                <div className="order-items">
                  {order.items.map((item, index) => (
                    <div key={`${order.id}-${index}`}>
                      <span>{item.quantity} ×</span>
                      <strong>{item.name}</strong>
                      <b>{money.format((item.unitPrice * item.quantity) / 100)}</b>
                    </div>
                  ))}
                </div>
                <footer>
                  <span>Teslimat adresi</span>
                  <p>{order.address}</p>
                  {order.paymentId && (
                    <small>Shopier ödeme no: {order.paymentId}</small>
                  )}
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
      <StoreSiteFooter businessName={businessName} address={businessAddress} />
    </main>
  );
}
