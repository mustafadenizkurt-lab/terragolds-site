import { mapN11OrderPayload, type MappedN11Order } from "./order-mapping";
import { getOrders, type N11OrderPackage } from "./client";

export async function ensureN11OrdersTable(db: D1Database) {
  // trendyol_orders/hepsiburada_orders ile birebir aynı gerekçe: ana
  // `orders` tablosunun payment_provider CHECK kısıtlaması sadece
  // ('shopier','paytr','iyzico') kabul ediyor - N11 siparişleri burada ayrı
  // tutulup okuma anında (app/api/admin/shipping) birleştiriliyor.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS n11_orders (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'paid',
        customer_first_name TEXT NOT NULL DEFAULT '',
        customer_last_name TEXT NOT NULL DEFAULT '',
        customer_email TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL DEFAULT '',
        shipping_address TEXT NOT NULL DEFAULT '',
        shipping_district TEXT NOT NULL DEFAULT '',
        shipping_city TEXT NOT NULL DEFAULT '',
        shipping_postcode TEXT NOT NULL DEFAULT '',
        shipping_country TEXT NOT NULL DEFAULT '',
        subtotal_amount INTEGER NOT NULL DEFAULT 0,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        shipping_amount INTEGER NOT NULL DEFAULT 0,
        total_amount INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'TRY',
        customer_note TEXT NOT NULL DEFAULT '',
        shipping_carrier TEXT NOT NULL DEFAULT '',
        tracking_number TEXT NOT NULL DEFAULT '',
        n11_shipment_package_id TEXT,
        shipped_at TEXT,
        delivered_at TEXT,
        items_json TEXT NOT NULL DEFAULT '[]',
        raw_payload TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

// importTrendyolOrder ile aynı desen: bilinen her alanı gerçek kolonlara
// yazar, ham yanıtın tamamını raw_payload'a koyar. Poll tabanlı (webhook
// değil) senkron - INSERT OR IGNORE sayesinde aynı sipariş tekrar çekilirse
// sessizce atlanır.
export async function importN11Order(
  db: D1Database,
  payload: N11OrderPackage,
): Promise<void> {
  await ensureN11OrdersTable(db);

  const mapped: MappedN11Order = mapN11OrderPayload({
    orderNumber: payload.orderNumber,
    status: payload.status,
    totalAmount: payload.totalAmount,
    discountAmount: payload.discountAmount,
    customerFirstName: payload.customerFirstName,
    customerLastName: payload.customerLastName,
    customerEmail: payload.customerEmail,
    trackingNumber: payload.trackingNumber,
    shippingAddress: payload.shippingAddress,
    lines: payload.lines.map((line) => ({
      stockCode: line.stockCode,
      productName: line.productName,
      quantity: line.quantity,
      price: line.price,
      productId: line.productId,
    })),
  });
  const subtotalAmount = mapped.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  await db
    .prepare(
      `INSERT OR IGNORE INTO n11_orders (
        id, status, customer_first_name, customer_last_name, customer_email,
        customer_phone, shipping_address, shipping_district, shipping_city,
        shipping_postcode, shipping_country, subtotal_amount, discount_amount,
        shipping_amount, total_amount, currency, tracking_number,
        n11_shipment_package_id, items_json, raw_payload, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    .bind(
      mapped.orderNumber,
      mapped.status,
      mapped.customerFirstName,
      mapped.customerLastName,
      mapped.customerEmail,
      mapped.customerPhone,
      mapped.shippingAddress,
      mapped.shippingDistrict,
      mapped.shippingCity,
      mapped.shippingPostcode,
      mapped.shippingCountry,
      subtotalAmount,
      mapped.discountAmount,
      mapped.totalAmount,
      mapped.currency,
      mapped.trackingNumber,
      String(payload.id),
      JSON.stringify(mapped.items),
      JSON.stringify(payload),
    )
    .run();
}

export type N11OrderSyncResult = {
  imported: number;
  errors: string[];
};

// syncTrendyolOrders/syncHepsiburadaOrders ile aynı desen: webhook değil
// dönemsel poll, admin panelinden elle tetiklenir. Son 7 günün siparişlerini
// çeker.
export async function syncN11Orders(db: D1Database): Promise<N11OrderSyncResult> {
  await ensureN11OrdersTable(db);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let imported = 0;
  const errors: string[] = [];
  try {
    const { content } = await getOrders({
      startDate: sevenDaysAgo,
      endDate: new Date().toISOString(),
      size: 200,
    });
    for (const order of content) {
      try {
        await importN11Order(db, order);
        imported += 1;
      } catch (error) {
        errors.push(
          `Sipariş #${order.orderNumber}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
        );
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "N11 siparişleri alınamadı.");
  }

  return { imported, errors };
}
