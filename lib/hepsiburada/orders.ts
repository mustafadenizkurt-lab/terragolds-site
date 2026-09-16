import { mapHepsiburadaOrderPayload, type MappedHepsiburadaOrder } from "./order-mapping";
import { getOrders, type HepsiburadaOrder } from "./client";

export async function ensureHepsiburadaOrdersTable(db: D1Database) {
  // shopify_orders/trendyol_orders ile birebir aynı gerekçe: ana `orders`
  // tablosunun payment_provider CHECK kısıtlaması sadece
  // ('shopier','paytr','iyzico') kabul ediyor, onu genişletmek canlıdaki
  // gerçek müşteri siparişlerini tutan tabloyu yeniden kurmayı gerektirir.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS hepsiburada_orders (
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
        hepsiburada_package_number TEXT,
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

// importShopifyOrder/importTrendyolOrder ile aynı desen: bilinen her alanı
// gerçek kolonlara yazar, *ve* ham yanıtın tamamını raw_payload'a koyar.
// Poll tabanlı senkron (webhook yerine dönemsel getOrders() çağrısı) bu
// yüzden INSERT OR IGNORE: aynı sipariş tekrar çekilirse (id = orderNumber
// PRIMARY KEY) sessizce atlanır, D1'deki durumun üzerine yazılmaz.
export async function importHepsiburadaOrder(
  db: D1Database,
  payload: HepsiburadaOrder,
): Promise<void> {
  await ensureHepsiburadaOrdersTable(db);

  const mapped: MappedHepsiburadaOrder = mapHepsiburadaOrderPayload(payload);
  const subtotalAmount = mapped.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  await db
    .prepare(
      `INSERT OR IGNORE INTO hepsiburada_orders (
        id, status, customer_first_name, customer_last_name, customer_email,
        customer_phone, shipping_address, shipping_district, shipping_city,
        shipping_postcode, shipping_country, subtotal_amount, discount_amount,
        shipping_amount, total_amount, currency, tracking_number,
        hepsiburada_package_number, items_json, raw_payload, updated_at
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
      payload.packageNumber,
      JSON.stringify(mapped.items),
      JSON.stringify(payload),
    )
    .run();
}

export type HepsiburadaOrderSyncResult = {
  imported: number;
  errors: string[];
};

// Hepsiburada webhook değil, dönemsel poll (getOrders) ile çalışıyor - admin
// panelinden elle tetiklenir. Son 7 günün siparişlerini çeker; zaten var
// olanlar importHepsiburadaOrder'daki INSERT OR IGNORE sayesinde sessizce
// atlanır.
export async function syncHepsiburadaOrders(db: D1Database): Promise<HepsiburadaOrderSyncResult> {
  await ensureHepsiburadaOrdersTable(db);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let imported = 0;
  const errors: string[] = [];
  try {
    const { items } = await getOrders({
      startDate: sevenDaysAgo.toISOString(),
      endDate: now.toISOString(),
      limit: 200,
    });
    for (const order of items) {
      try {
        await importHepsiburadaOrder(db, order);
        imported += 1;
      } catch (error) {
        errors.push(
          `Sipariş #${order.orderNumber}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
        );
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Hepsiburada siparişleri alınamadı.");
  }

  return { imported, errors };
}
