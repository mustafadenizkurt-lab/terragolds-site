import { getD1 } from "./store-db";
import { sendTransactionalEmail } from "./transactional-email";

type ConfirmationOrderRow = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  shipping_address: string;
  shipping_district: string;
  shipping_city: string;
  shipping_postcode: string;
  total_amount: number;
  shipping_amount: number;
  discount_amount: number;
  payment_id: string | null;
};

type ConfirmationItemRow = {
  product_name: string;
  unit_price: number;
  quantity: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTl(cents: number) {
  return `${(cents / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TL`;
}

// Tek ödeme noktası (lib/order-payment.ts markOrderPaid) tarafından, bir
// sipariş pending/failed'den paid'e geçtiği anda bir kez çağrılır - kapıda
// ödeme dahil tüm sağlayıcılar aynı yoldan geçtiği için müşteri her zaman
// "siparişiniz alındı" onayını alır. E-posta gönderimi asla ödeme akışını
// kesmesin diye hata burada yutulur, çağıran taraf da .catch(() => {}) ile
// sarmalı.
export async function sendOrderConfirmationEmail(orderId: string) {
  const db = getD1();
  const order = await db
    .prepare(
      `SELECT id, customer_first_name, customer_last_name, customer_email,
              shipping_address, shipping_district, shipping_city,
              shipping_postcode, total_amount, shipping_amount,
              discount_amount, payment_id
       FROM orders WHERE id = ?`,
    )
    .bind(orderId)
    .first<ConfirmationOrderRow>();
  if (!order || !order.customer_email) return;

  const items = await db
    .prepare(
      `SELECT product_name, unit_price, quantity
       FROM order_items WHERE order_id = ? ORDER BY id ASC`,
    )
    .bind(orderId)
    .all<ConfirmationItemRow>();

  const isCod = order.payment_id === "cod";
  const itemRows = items.results
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.product_name)}</td><td>${item.quantity}</td><td>${formatTl(
          item.unit_price * item.quantity,
        )}</td></tr>`,
    )
    .join("");
  const itemLines = items.results
    .map(
      (item) =>
        `${item.product_name} x${item.quantity} — ${formatTl(item.unit_price * item.quantity)}`,
    )
    .join("\n");

  const address = [
    order.shipping_address,
    order.shipping_district,
    order.shipping_city,
    order.shipping_postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const customerName = `${order.customer_first_name} ${order.customer_last_name}`.trim();
  const paymentNote = isCod
    ? "Ödemeniz kargo teslimatında kapıda tahsil edilecektir."
    : "Ödemeniz başarıyla alınmıştır.";

  await sendTransactionalEmail({
    to: order.customer_email,
    subject: `Siparişiniz alındı — #${order.id}`,
    idempotencyKey: `order-confirmation-${order.id}`,
    html: `<div style="font-family:Arial,sans-serif;color:#122e27;line-height:1.6">
      <h1 style="font-family:Georgia,serif;font-weight:400">Siparişiniz alındı</h1>
      <p>Merhaba ${escapeHtml(customerName)}, siparişiniz başarıyla kaydedildi. ${paymentNote}</p>
      <p><strong>Sipariş numarası:</strong> ${escapeHtml(order.id)}</p>
      <table style="width:100%;border-collapse:collapse" cellpadding="6">
        <thead><tr><th align="left">Ürün</th><th align="left">Adet</th><th align="left">Tutar</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p><strong>Kargo tutarı:</strong> ${formatTl(order.shipping_amount)}<br/>
      ${order.discount_amount > 0 ? `<strong>İndirim:</strong> -${formatTl(order.discount_amount)}<br/>` : ""}
      <strong>Toplam:</strong> ${formatTl(order.total_amount)}</p>
      <p><strong>Teslimat adresi:</strong> ${escapeHtml(address)}</p>
      <p>Siparişinizin hazırlanma ve kargo durumunu size ayrıca e-posta ile bildireceğiz.</p>
    </div>`,
    text: `Merhaba ${customerName},\n\nSiparişiniz alındı (#${order.id}). ${paymentNote}\n\n${itemLines}\n\nKargo: ${formatTl(order.shipping_amount)}\nToplam: ${formatTl(order.total_amount)}\n\nTeslimat adresi: ${address}`,
  });
}
