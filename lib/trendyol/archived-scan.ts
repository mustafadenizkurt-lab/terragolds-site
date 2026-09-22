import { getProductByBarcode } from "./client";

const DISCOVERY_BATCH_SIZE = 1000; // ~4000 ürünün ilk taraması ~4 çalıştırmada (bugünkü cron ritmiyle ~1 gün) tamamlanır
const CURSOR_SETTING_KEY = "trendyol_archive_scan_cursor";

async function ensureArchivedProductsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS trendyol_archived_products (
        barcode TEXT PRIMARY KEY,
        product_id INTEGER NOT NULL,
        first_detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT
      )`,
    )
    .run();
}

async function getCursor(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM store_settings WHERE key = ?")
    .bind(CURSOR_SETTING_KEY)
    .first<{ value: string }>();
  return row ? Number(row.value) || 0 : 0;
}

async function setCursor(db: D1Database, cursor: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(CURSOR_SETTING_KEY, String(cursor))
    .run();
}

export type ArchivedScanResult = {
  rechecked: number;
  discovered: number;
  autoLocked: string[]; // düzeltilip kilitlenen barkodlar
  newlyArchived: string[]; // bu çalıştırmada YENİ tespit edilen pasif ürünler
  errors: string[];
};

// Admin, Trendyol'da marka/logo/yasaklı kelime gibi sebeplerle pasife
// alınan ürünlerin görselini panelden elle düzeltiyor - kendisi "düzelttim"
// diye bir yere işaretlemek istemiyor (tek tek çok sayıda ürün için pratik
// değil). Bu yüzden sistem kendisi periyodik olarak (cron) kontrol ediyor:
//
// 1. Daha önce "pasif" (archived=true) olarak tespit edilmiş ama henüz
//    "düzeltildi" işaretlenmemiş ürünleri (trendyol_archived_products,
//    resolved_at IS NULL) yeniden sorgular - artık archived=false ise
//    (admin düzeltip Trendyol onayladıysa) resolved_at'i doldurur VE
//    products.trendyol_image_locked_at'i otomatik set eder (bkz.
//    refreshTrendyolImages() - kilitli ürünlerin görselini bir daha D1'den
//    Trendyol'a göndermiyor, elle yapılan düzeltmenin üzerine yazmıyor).
// 2. Henüz hiç kontrol edilmemiş ürünlerden bir sonraki DISCOVERY_BATCH_SIZE
//    kadarını tarar (store_settings'teki bir imleçle kaldığı yerden devam
//    eder, sona gelince başa döner) - şu an archived=true olanları tabloya
//    kaydeder.
//
// getProductByBarcode() artık TÜM barkodlar için AYNI (normalize edilmiş)
// rate-limit anahtarını kullanıyor (bkz. client.ts) - binlerce ürünü
// tararken Trendyol'un gerçek 50/10sn limitine düzgün uyuyor.
export async function scanTrendyolArchivedProducts(
  db: D1Database,
): Promise<ArchivedScanResult> {
  await ensureArchivedProductsTable(db);

  const errors: string[] = [];
  const autoLocked: string[] = [];
  const newlyArchived: string[] = [];
  let rechecked = 0;
  let discovered = 0;

  const unresolved = await db
    .prepare(
      "SELECT barcode, product_id AS productId FROM trendyol_archived_products WHERE resolved_at IS NULL",
    )
    .all<{ barcode: string; productId: number }>();

  for (const row of unresolved.results) {
    try {
      const info = await getProductByBarcode(row.barcode);
      rechecked += 1;
      if (!info.archived) {
        await db.batch([
          db
            .prepare(
              "UPDATE trendyol_archived_products SET resolved_at = CURRENT_TIMESTAMP, last_checked_at = CURRENT_TIMESTAMP WHERE barcode = ?",
            )
            .bind(row.barcode),
          db
            .prepare(
              "UPDATE products SET trendyol_image_locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            )
            .bind(row.productId),
        ]);
        autoLocked.push(row.barcode);
      } else {
        await db
          .prepare(
            "UPDATE trendyol_archived_products SET last_checked_at = CURRENT_TIMESTAMP WHERE barcode = ?",
          )
          .bind(row.barcode)
          .run();
      }
    } catch (error) {
      errors.push(`${row.barcode}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }

  const cursor = await getCursor(db);
  const batch = await db
    .prepare(
      `SELECT id, trendyol_barcode AS barcode FROM products
       WHERE trendyol_barcode IS NOT NULL AND trendyol_image_locked_at IS NULL
             AND id > ?
       ORDER BY id ASC LIMIT ?`,
    )
    .bind(cursor, DISCOVERY_BATCH_SIZE)
    .all<{ id: number; barcode: string }>();

  let lastId = cursor;
  for (const row of batch.results) {
    lastId = row.id;
    try {
      const info = await getProductByBarcode(row.barcode);
      discovered += 1;
      if (info.archived) {
        await db
          .prepare(
            `INSERT INTO trendyol_archived_products (barcode, product_id, first_detected_at, last_checked_at, resolved_at)
             VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
             ON CONFLICT(barcode) DO UPDATE SET
               last_checked_at = CURRENT_TIMESTAMP, resolved_at = NULL, product_id = excluded.product_id`,
          )
          .bind(row.barcode, row.id)
          .run();
        newlyArchived.push(row.barcode);
      }
    } catch (error) {
      errors.push(`${row.barcode}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }
  // Batch tam doluysa (LIMIT'e ulaşıldıysa) daha taranacak ürün olabilir -
  // imleci son işlenen id'de bırak. Batch LIMIT'ten azsa listenin sonuna
  // gelindi demektir, bir sonraki çalıştırma başa (0) dönüp yeni bir tam
  // tur başlatır.
  await setCursor(db, batch.results.length < DISCOVERY_BATCH_SIZE ? 0 : lastId);

  return { rechecked, discovered, autoLocked, newlyArchived, errors };
}
