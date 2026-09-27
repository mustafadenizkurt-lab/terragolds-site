import { mapTrendyolOrderPayload, type MappedTrendyolOrder } from "./order-mapping";
import { getOrders, type TrendyolOrderPackage } from "./client";

export async function ensureTrendyolOrdersTable(db: D1Database) {
  // shopify_orders ile birebir aynı gerekçe (bkz. lib/shopify/orders.ts):
  // ana `orders` tablosunun payment_provider CHECK kısıtlaması sadece
  // ('shopier','paytr','iyzico') kabul ediyor, onu genişletmek canlıdaki
  // gerçek müşteri siparişlerini tutan tabloyu yeniden kurmayı gerektirir.
  // Trendyol siparişlerini burada ayrı tutup okuma anında (bkz.
  // app/api/admin/shipping) birleştirmek aynı birleşik admin görünümünü
  // hiçbir riske girmeden veriyor.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS trendyol_orders (
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
        trendyol_shipment_package_id TEXT,
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

// shopify_orders'ın importShopifyOrder'ı gibi: bilinen her alanı gerçek
// kolonlara yazar, *ve* ham yanıtın tamamını raw_payload'a koyar - bu
// eşlemenin bugün karşılamadığı bir alan ileride gerekirse hiçbir şey
// kaybolmamış olur.
//
// Önceki sürüm burada INSERT OR IGNORE kullanıyordu (aynı sipariş tekrar
// çekilirse D1'deki durumun üzerine hiç yazılmazdı) - niyet muhtemelen
// "admin panelinden elle yapılan bir değişikliği ezmemekti", ama gerçek
// sonucu şu oldu: Trendyol'da bir sipariş "Kargoda"dan "Teslim Edildi"ye
// geçse bile bizim tarafta SONSUZA KADAR ilk görüldüğü durumda donuk
// kalıyordu (her 6 saatte bir çalışan cron - bkz. worker/index.ts - yeni
// sipariş yakalıyordu ama mevcut birinin durumunu hiç güncellemiyordu).
// Şimdi bir UPSERT: durum/takip no/paket id Trendyol'un en güncel
// yanıtıyla HER senkronda tazeleniyor - Trendyol burada tek gerçek kaynak
// (kargo firmasını biz zaten fulfillTrendyolOrder ile Trendyol'a
// bildiriyoruz, admin panelinden elle girilen shipping_carrier'a
// dokunulmuyor).
export async function importTrendyolOrder(
  db: D1Database,
  payload: TrendyolOrderPackage,
): Promise<void> {
  await ensureTrendyolOrdersTable(db);

  const mapped: MappedTrendyolOrder = mapTrendyolOrderPayload(payload);
  const subtotalAmount = mapped.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  await db
    .prepare(
      `INSERT INTO trendyol_orders (
        id, status, customer_first_name, customer_last_name, customer_email,
        customer_phone, shipping_address, shipping_district, shipping_city,
        shipping_postcode, shipping_country, subtotal_amount, discount_amount,
        shipping_amount, total_amount, currency, tracking_number,
        trendyol_shipment_package_id, items_json, raw_payload, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        tracking_number = excluded.tracking_number,
        trendyol_shipment_package_id = excluded.trendyol_shipment_package_id,
        shipped_at = CASE
          WHEN excluded.status IN ('shipped', 'delivered')
            THEN COALESCE(shipped_at, CURRENT_TIMESTAMP)
          ELSE shipped_at
        END,
        delivered_at = CASE
          WHEN excluded.status = 'delivered'
            THEN COALESCE(delivered_at, CURRENT_TIMESTAMP)
          ELSE delivered_at
        END,
        raw_payload = excluded.raw_payload,
        updated_at = CURRENT_TIMESTAMP`,
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
      String(payload.shipmentPackageId),
      JSON.stringify(mapped.items),
      JSON.stringify(payload),
    )
    .run();
}

export type TrendyolOrderSyncResult = {
  imported: number;
  errors: string[];
};

// Trendyol webhook değil, dönemsel poll (getOrders) ile çalışıyor - hem
// admin panelinden elle (GET/POST /api/admin/trendyol/orders) hem de
// worker/index.ts'deki 6 saatlik cron'dan tetikleniyor. Pencere kasıtlı
// olarak 7 değil 30 gün: importTrendyolOrder artık bir UPSERT olduğu için
// (bkz. oradaki yorum) zaten kargoda olan bir siparişin Trendyol'da
// "Teslim Edildi"ye dönmesini yakalamak için o siparişin bu pencerede
// tekrar tekrar görünmesi gerekiyor - 7 günlük eski pencerede, kargoya
// verilişinden bir hafta sonra teslim olan bir sipariş bir daha hiç
// çekilmiyor, durumu sonsuza kadar "Kargoda" görünüyordu.
export async function syncTrendyolOrders(db: D1Database): Promise<TrendyolOrderSyncResult> {
  await ensureTrendyolOrdersTable(db);

  const windowStart = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let imported = 0;
  const errors: string[] = [];
  try {
    const { content } = await getOrders({ startDate: windowStart, endDate: Date.now(), size: 200 });
    for (const order of content) {
      try {
        await importTrendyolOrder(db, order);
        imported += 1;
      } catch (error) {
        errors.push(
          `Sipariş #${order.orderNumber}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
        );
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Trendyol siparişleri alınamadı.");
  }

  return { imported, errors };
}
