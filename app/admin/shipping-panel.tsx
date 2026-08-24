"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminShippingOrder } from "../../lib/admin-dashboard-types";
import {
  defaultShippingTrackingSettings,
  type ShippingTrackingSettings,
} from "../../lib/shipping-tracking-types";

type ShippingFilter = "ready" | "shipped" | "delivered" | "pending" | "all";

const ORDERS_PER_PAGE = 10;

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

const statusLabels: Record<string, string> = {
  pending: "Ödeme bekliyor",
  paid: "Hazırlanacak",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  cancelled: "İptal",
};

function trackingUrlForDraft(order: AdminShippingOrder) {
  const carrier = order.shippingCarrier.trim().toLocaleLowerCase("tr-TR");
  const trackingNumber = encodeURIComponent(order.trackingNumber.trim());
  if (!carrier || !trackingNumber) return "";
  if (carrier.includes("yurti") || carrier.includes("yurtici")) {
    return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${trackingNumber}`;
  }
  if (carrier.includes("aras")) {
    return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${trackingNumber}`;
  }
  if (carrier.includes("mng")) {
    return `https://www.mngkargo.com.tr/gonderi-takip?code=${trackingNumber}`;
  }
  if (carrier.includes("sürat") || carrier.includes("surat")) {
    return `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${trackingNumber}`;
  }
  if (carrier.includes("ptt")) {
    return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${trackingNumber}`;
  }
  if (carrier.includes("ups")) {
    return `https://www.ups.com/track?loc=tr_TR&tracknum=${trackingNumber}`;
  }
  if (carrier.includes("hepsijet")) {
    return `https://www.hepsijet.com/gonderi-takibi/${trackingNumber}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${order.shippingCarrier} kargo takip ${order.trackingNumber}`,
  )}`;
}

function formatAutoDelivery(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function readResponse(response: Response) {
  const body = (await response.json()) as {
    orders?: AdminShippingOrder[];
    trackingSettings?: ShippingTrackingSettings;
    error?: string;
  };
  if (!response.ok) throw new Error(body.error || "İşlem tamamlanamadı.");
  return body;
}

export default function ShippingPanel({
  onChanged,
}: {
  onChanged: () => void | Promise<void>;
}) {
  const [orders, setOrders] = useState<AdminShippingOrder[]>([]);
  const [trackingSettings, setTrackingSettings] =
    useState<ShippingTrackingSettings>(defaultShippingTrackingSettings);
  const [filter, setFilter] = useState<ShippingFilter>("ready");
  const [page, setPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readResponse(
        await fetch("/api/admin/shipping", { cache: "no-store" }),
      );
      setOrders(body.orders ?? []);
      setTrackingSettings(
        body.trackingSettings ?? defaultShippingTrackingSettings,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Kargo kayıtları alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Protected shipping records are loaded once when the tab becomes visible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders();
  }, []);

  const counts = useMemo(
    () => ({
      ready: orders.filter((order) => order.status === "paid").length,
      shipped: orders.filter((order) => order.status === "shipped").length,
      delivered: orders.filter((order) => order.status === "delivered").length,
      pending: orders.filter((order) => order.status === "pending").length,
      all: orders.length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (filter === "ready") return order.status === "paid";
        if (filter === "shipped") return order.status === "shipped";
        if (filter === "delivered") return order.status === "delivered";
        if (filter === "pending") return order.status === "pending";
        return true;
      }),
    [filter, orders],
  );
  const pageCount = Math.max(
    1,
    Math.ceil(filteredOrders.length / ORDERS_PER_PAGE),
  );
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * ORDERS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(
    pageStart,
    pageStart + ORDERS_PER_PAGE,
  );

  const selectFilter = (value: ShippingFilter) => {
    setFilter(value);
    setPage(1);
    setExpandedOrderId(null);
  };

  const updateDraft = (
    orderId: string,
    field: "shippingCarrier" | "trackingNumber",
    value: string,
  ) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order,
      ),
    );
  };

  const saveShipping = async (
    order: AdminShippingOrder,
    nextStatus = order.status,
  ) => {
    setSavingId(order.id);
    setError("");
    try {
      await readResponse(
        await fetch("/api/admin/shipping", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: order.id,
            status: nextStatus,
            shippingCarrier: order.shippingCarrier,
            trackingNumber: order.trackingNumber,
          }),
        }),
      );
      await loadOrders();
      await onChanged();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Kargo kaydı güncellenemedi.",
      );
    } finally {
      setSavingId("");
    }
  };

  const markDelivered = (order: AdminShippingOrder) => {
    if (
      !window.confirm(
        `${order.id} numaralı sipariş teslim edildi olarak işaretlensin mi?`,
      )
    ) {
      return;
    }
    void saveShipping(order, "delivered");
  };

  return (
    <div className="admin-shipping">
      <section className="admin-shipping-summary">
        <div>
          <p className="admin-kicker">Sipariş operasyonu</p>
          <h2>Kargo yönetimi</h2>
          <span>
            Hazırlanacak paketleri, müşteri teslimat bilgilerini ve takip
            numaralarını tek ekrandan yönetin.
          </span>
        </div>
        <article>
          <strong>{counts.ready}</strong>
          <span>Hazırlanacak sipariş</span>
        </article>
      </section>

      <nav className="admin-shipping-filters" aria-label="Kargo filtreleri">
        {(
          [
            ["ready", "Hazırlanacak"],
            ["shipped", "Kargoda"],
            ["delivered", "Teslim edildi"],
            ["pending", "Ödeme bekliyor"],
            ["all", "Tümü"],
          ] as Array<[ShippingFilter, string]>
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => selectFilter(value)}
          >
            {label} <span>{counts[value]}</span>
          </button>
        ))}
      </nav>

      {error && <div className="admin-alert error"><span>!</span><p>{error}</p></div>}

      {loading ? (
        <div className="admin-loading"><span /><p>Kargo kayıtları hazırlanıyor…</p></div>
      ) : (
        <div className="admin-shipping-list">
          {paginatedOrders.map((order, index) => {
            const expanded = expandedOrderId === order.id;
            const orderNumber = pageStart + index + 1;
            const trackingUrl = order.trackingUrl || trackingUrlForDraft(order);
            return (
            <article
              className={`admin-shipping-order${expanded ? " expanded" : ""}`}
              key={order.id}
            >
              <header>
                <button
                  className="admin-shipping-order-toggle"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`shipping-order-${order.id}`}
                  onClick={() =>
                    setExpandedOrderId((current) =>
                      current === order.id ? null : order.id,
                    )
                  }
                >
                  <span className="admin-shipping-order-number">
                    <b>{orderNumber}.</b>
                    <small>Sipariş</small>
                  </span>
                  <span className="admin-shipping-order-customer">
                    <strong>{order.customerName}</strong>
                    <small>
                      {order.id} ·{" "}
                      {new Date(order.createdAt).toLocaleString("tr-TR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </span>
                  <em className={`admin-order-state ${order.status}`}>
                    {statusLabels[order.status] ?? order.status}
                  </em>
                  <b className="admin-shipping-order-total">
                    {currency.format(order.totalAmount / 100)}
                  </b>
                  <span className="admin-shipping-order-detail">
                    {expanded ? "Ayrıntıları gizle" : "Ayrıntıları göster"}
                    <i aria-hidden="true" />
                  </span>
                </button>
              </header>

              {expanded && (
              <div
                className="admin-shipping-order-body"
                id={`shipping-order-${order.id}`}
              >
                <section>
                  <p>Müşteri ve teslimat</p>
                  <h3>{order.customerName}</h3>
                  <a href={`tel:${order.phone}`}>{order.phone}</a>
                  <a href={`mailto:${order.email}`}>{order.email}</a>
                  <address>{order.address}</address>
                  {order.customerNote && (
                    <blockquote>
                      <span>Müşteri açıklaması</span>
                      {order.customerNote}
                    </blockquote>
                  )}
                </section>

                <section className="admin-package-section">
                  <div className="admin-package-heading">
                    <p>Paket içeriği</p>
                    <span>
                      {order.items.reduce(
                        (total, item) => total + item.quantity,
                        0,
                      )}{" "}
                      adet · {order.items.length} ürün çeşidi
                    </span>
                  </div>
                  <div className="admin-shipping-items">
                    {order.items.map((item, index) => (
                      <div key={`${order.id}-${index}`}>
                        <span>{item.quantity} adet</span>
                        <strong>
                          {item.name}
                          <small>
                            Birim fiyat: {currency.format(item.unitPrice / 100)}
                          </small>
                        </strong>
                        <b>
                          {currency.format(
                            (item.unitPrice * item.quantity) / 100,
                          )}
                        </b>
                      </div>
                    ))}
                  </div>
                  <div className="admin-order-pricing">
                    <div>
                      <span>Ara toplam</span>
                      <b>{currency.format(order.subtotalAmount / 100)}</b>
                    </div>
                    <div
                      className={
                        order.discountCode ? "discount-applied" : undefined
                      }
                    >
                      <span>İndirim kodu kullanıldı mı?</span>
                      <b>
                        {order.discountCode
                          ? `Evet · ${order.discountCode}`
                          : "Hayır"}
                      </b>
                    </div>
                    {order.discountAmount > 0 && (
                      <div className="discount-applied">
                        <span>İndirim tutarı</span>
                        <b>−{currency.format(order.discountAmount / 100)}</b>
                      </div>
                    )}
                    <div>
                      <span>Kargo</span>
                      <b>
                        {order.shippingAmount > 0
                          ? currency.format(order.shippingAmount / 100)
                          : "Ücretsiz"}
                      </b>
                    </div>
                    <div className="admin-order-pricing-total">
                      <span>Sipariş toplamı</span>
                      <b>{currency.format(order.totalAmount / 100)}</b>
                    </div>
                  </div>
                  <small className="admin-payment-provider">
                    Ödeme yöntemi:{" "}
                    {order.paymentProvider.toLocaleUpperCase("tr-TR")}
                  </small>
                </section>

                <section className="admin-shipping-form">
                  <p>Kargo bilgileri</p>
                  {order.status === "pending" ? (
                    <div className="admin-shipping-waiting">
                      Ödeme onaylandıktan sonra kargo bilgileri girilebilir.
                    </div>
                  ) : (
                    <>
                      <label>
                        <span>Kargo firması</span>
                        <input
                          list="shipping-carriers"
                          value={order.shippingCarrier}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "shippingCarrier",
                              event.target.value,
                            )
                          }
                          placeholder="Firma seçin veya yazın"
                        />
                      </label>
                      <label>
                        <span>Takip numarası</span>
                        <input
                          value={order.trackingNumber}
                          onChange={(event) =>
                            updateDraft(
                              order.id,
                              "trackingNumber",
                              event.target.value,
                            )
                          }
                          placeholder="Takip numarasını girin"
                        />
                      </label>
                      {(trackingUrl || order.autoDeliverAt) && (
                        <div className="admin-tracking-link-card">
                          {trackingUrl && (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Takip linkini aÃ§
                            </a>
                          )}
                          {order.status === "shipped" && order.autoDeliverAt && (
                            <small>
                              API yoksa otomatik teslim tarihi:{" "}
                              {formatAutoDelivery(order.autoDeliverAt)}
                            </small>
                          )}
                        </div>
                      )}
                      <div className="admin-shipping-actions">
                        {(order.status === "shipped" ||
                          order.status === "delivered") && (
                          <button
                            className="admin-secondary-button"
                            type="button"
                            disabled={savingId === order.id}
                            onClick={() => void saveShipping(order)}
                          >
                            Bilgileri güncelle
                          </button>
                        )}
                        {order.status === "shipped" &&
                          trackingSettings.manualDeliveryEnabled && (
                            <button
                              className="admin-primary-button"
                              type="button"
                              disabled={savingId === order.id}
                              onClick={() => markDelivered(order)}
                            >
                              {savingId === order.id
                                ? "Kaydediliyor…"
                                : "Teslim edildi"}
                            </button>
                          )}
                        {order.status === "paid" && (
                          <button
                            className="admin-primary-button"
                            type="button"
                            disabled={savingId === order.id}
                            onClick={() => void saveShipping(order, "shipped")}
                          >
                            {savingId === order.id
                              ? "Kaydediliyor…"
                              : "Kargoya ver"}
                          </button>
                        )}
                      </div>
                      {order.status === "delivered" && order.deliveredAt && (
                        <div className="admin-delivered-confirmation">
                          <span aria-hidden="true">✓</span>
                          <p>
                            Teslimat{" "}
                            {new Date(order.deliveredAt).toLocaleString(
                              "tr-TR",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            )}{" "}
                            tarihinde tamamlandı.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </div>
              )}
            </article>
            );
          })}

          {!filteredOrders.length && (
            <div className="admin-shipping-empty">
              <strong>Bu durumda sipariş bulunmuyor.</strong>
              <span>Yeni kayıtlar geldiğinde burada listelenecek.</span>
            </div>
          )}

          {filteredOrders.length > 0 && (
            <footer className="admin-shipping-pagination">
              <span>
                {pageStart + 1}–
                {Math.min(pageStart + ORDERS_PER_PAGE, filteredOrders.length)} /{" "}
                {filteredOrders.length} sipariş
              </span>
              <nav aria-label="Kargo sipariş sayfaları">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                    setExpandedOrderId(null);
                  }}
                  aria-label="Önceki sayfa"
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <button
                      type="button"
                      className={pageNumber === safePage ? "active" : ""}
                      key={pageNumber}
                      onClick={() => {
                        setPage(pageNumber);
                        setExpandedOrderId(null);
                      }}
                      aria-current={
                        pageNumber === safePage ? "page" : undefined
                      }
                    >
                      {pageNumber}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={safePage === pageCount}
                  onClick={() => {
                    setPage((current) =>
                      Math.min(pageCount, current + 1),
                    );
                    setExpandedOrderId(null);
                  }}
                  aria-label="Sonraki sayfa"
                >
                  ›
                </button>
              </nav>
            </footer>
          )}
        </div>
      )}

      <datalist id="shipping-carriers">
        <option value="Yurtiçi Kargo" />
        <option value="Aras Kargo" />
        <option value="MNG Kargo" />
        <option value="Sürat Kargo" />
        <option value="PTT Kargo" />
        <option value="UPS Türkiye" />
        <option value="Hepsijet" />
      </datalist>
    </div>
  );
}
