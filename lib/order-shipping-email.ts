import { getD1 } from "./store-db";
import { sendTransactionalEmail } from "./transactional-email";

type ShippingOrderRow = {
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Sadece kendi site siparişlerimiz için (Trendyol/Hepsiburada/N11 siparişleri
// kendi platformlarında bildirim alıyor) - app/api/admin/shipping/route.ts'nin
// PATCH handler'ından, durum gerçekten 'shipped' veya 'delivered'a geçtiği
// anda bir kez çağrılır.
export async function sendShippingStatusEmail(input: {
  orderId: string;
  status: "shipped" | "delivered";
  shippingCarrier: string;
  trackingNumber: string;
}) {
  const order = await getD1()
    .prepare(
      `SELECT customer_first_name, customer_last_name, customer_email
       FROM orders WHERE id = ?`,
    )
    .bind(input.orderId)
    .first<ShippingOrderRow>();
  if (!order || !order.customer_email) return;

  const customerName = `${order.customer_first_name} ${order.customer_last_name}`.trim();
  const isShipped = input.status === "shipped";
  const subject = isShipped
    ? `Siparişiniz kargoya verildi — #${input.orderId}`
    : `Siparişiniz teslim edildi — #${input.orderId}`;
  const bodyHtml = isShipped
    ? `<p>Siparişiniz <strong>${escapeHtml(input.shippingCarrier)}</strong> ile kargoya verildi.</p>
       <p><strong>Takip numarası:</strong> ${escapeHtml(input.trackingNumber)}</p>`
    : `<p>Siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkür ederiz.</p>`;
  const bodyText = isShipped
    ? `Siparişiniz ${input.shippingCarrier} ile kargoya verildi.\nTakip numarası: ${input.trackingNumber}`
    : "Siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkür ederiz.";

  await sendTransactionalEmail({
    to: order.customer_email,
    subject,
    idempotencyKey: `order-shipping-${input.orderId}-${input.status}`,
    html: `<div style="font-family:Arial,sans-serif;color:#122e27;line-height:1.6">
      <h1 style="font-family:Georgia,serif;font-weight:400">${
        isShipped ? "Siparişiniz yolda" : "Siparişiniz teslim edildi"
      }</h1>
      <p>Merhaba ${escapeHtml(customerName)},</p>
      ${bodyHtml}
      <p><strong>Sipariş numarası:</strong> ${escapeHtml(input.orderId)}</p>
    </div>`,
    text: `Merhaba ${customerName},\n\n${bodyText}\n\nSipariş numarası: ${input.orderId}`,
  });
}
