import { getD1 } from "../../../lib/store-db";
import { verifyBirfaturaRequest } from "../../../lib/birfatura";

export const dynamic = "force-dynamic";

// BirFatura'nın "Özel Entegrasyon API" dokümantasyonuna göre zorunlu 3
// endpoint'ten biri (/api/orders) - kimlik doğrulaması "token" header'ıyla
// yapılıyor (lib/birfatura.ts).
//
// NOT: Bu route'un tam alan adları/response şekli, dokümandaki /api/orders
// sayfasının kendi örnek JSON'ıyla henüz birebir doğrulanmadı - şu anki
// hâli makul bir taslak. Gerçek dokümanın örnek response'u görülünce alan
// adları (büyük/küçük harf dahil) buna göre kesinleştirilmeli.
type OrderRow = {
  id: string;
  status: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingDistrict: string;
  shippingCity: string;
  shippingPostcode: string;
  shippingCountry: string;
  subtotalAmount: number;
  discountAmount: number;
  vatAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  trackingNumber: string;
  shippingCarrier: string;
  shippedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

type OrderItemRow = {
  orderId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
};

// D1'de tüm tutarlar kuruş cinsinden (integer) saklanıyor - dokümanda
// "ondalıklı tutarlar yuvarlanmamalı, hassasiyet korunmalı" dendiği için
// faturaya aktarılırken tam ondalıklı TL'ye çevriliyor (yuvarlama yok).
function kurusToTl(kurus: number): number {
  return kurus / 100;
}

export async function GET(request: Request) {
  if (!(await verifyBirfaturaRequest(request))) {
    return Response.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const since = searchParams.get("since"); // ISO tarih - opsiyonel, verilirse sadece bu tarihten sonra güncellenen siparişler

  const db = getD1();
  const orders = await db
    .prepare(
      `SELECT id, status, customer_first_name AS customerFirstName,
              customer_last_name AS customerLastName, customer_email AS customerEmail,
              customer_phone AS customerPhone, shipping_address AS shippingAddress,
              shipping_district AS shippingDistrict, shipping_city AS shippingCity,
              shipping_postcode AS shippingPostcode, shipping_country AS shippingCountry,
              subtotal_amount AS subtotalAmount, discount_amount AS discountAmount,
              vat_amount AS vatAmount, shipping_amount AS shippingAmount,
              total_amount AS totalAmount, currency, tracking_number AS trackingNumber,
              shipping_carrier AS shippingCarrier, shipped_at AS shippedAt,
              paid_at AS paidAt, created_at AS createdAt
       FROM orders
       WHERE status != 'pending'
         ${since ? "AND updated_at > ?" : ""}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(...(since ? [since, limit] : [limit]))
    .all<OrderRow>();

  if (orders.results.length === 0) {
    return Response.json({ orders: [] });
  }

  const orderIds = orders.results.map((order) => order.id);
  const placeholders = orderIds.map(() => "?").join(",");
  const items = await db
    .prepare(
      `SELECT order_id AS orderId, product_name AS productName,
              unit_price AS unitPrice, quantity
       FROM order_items WHERE order_id IN (${placeholders})`,
    )
    .bind(...orderIds)
    .all<OrderItemRow>();

  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of items.results) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  return Response.json({
    orders: orders.results.map((order) => ({
      orderNumber: order.id,
      status: order.status,
      customer: {
        firstName: order.customerFirstName,
        lastName: order.customerLastName,
        email: order.customerEmail,
        phone: order.customerPhone,
      },
      shippingAddress: {
        address: order.shippingAddress,
        district: order.shippingDistrict,
        city: order.shippingCity,
        postcode: order.shippingPostcode,
        country: order.shippingCountry,
      },
      amounts: {
        subtotal: kurusToTl(order.subtotalAmount),
        discount: kurusToTl(order.discountAmount),
        vat: kurusToTl(order.vatAmount),
        shipping: kurusToTl(order.shippingAmount),
        total: kurusToTl(order.totalAmount),
        currency: order.currency,
      },
      shipment: {
        carrier: order.shippingCarrier,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
      },
      items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
        name: item.productName,
        unitPrice: kurusToTl(item.unitPrice),
        quantity: item.quantity,
      })),
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    })),
  });
}
