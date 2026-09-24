import { ensureHepsiburadaColumns, getImportStatus } from "./client";
import { parseImportStatus } from "./import-parse";

export type HepsiburadaReconcileResult = {
  checkedTrackings: number;
  stillPending: number;
  verified: number;
  failed: number;
  accessDenied: number;
  failures: { merchantSku: string; reason: string }[];
  errors: string[];
};

// Hepsiburada içe aktarma asenkron ve trackingId kabul anlamına gelmiyor
// (gerçek örnek: importStatus FAILED "Access denied for merchant"). Bu adım
// doğrulanmamış trackingId'leri sorgular:
//  - başarı: hepsiburada_verified_at
//  - ürün bazlı hata/red: hepsiburada_last_error (otomatik yeniden gönderilmez)
//  - "Access denied" (entegratör yetkisi yok; ürünle ilgisi olmayan geçici
//    engel): ürün yeniden denenebilsin diye takip bilgisi sıfırlanır,
//    last_error YAZILMAZ.
export async function reconcileHepsiburadaImports(
  db: D1Database,
  maxTrackings = 10,
): Promise<HepsiburadaReconcileResult> {
  await ensureHepsiburadaColumns(db);
  const trackings = await db
    .prepare(
      `SELECT DISTINCT hepsiburada_listing_id AS id FROM products
       WHERE hepsiburada_listing_id IS NOT NULL AND hepsiburada_verified_at IS NULL
         AND hepsiburada_last_error IS NULL
       ORDER BY hepsiburada_listing_id LIMIT ?`,
    )
    .bind(maxTrackings)
    .all<{ id: string }>();

  const result: HepsiburadaReconcileResult = {
    checkedTrackings: 0,
    stillPending: 0,
    verified: 0,
    failed: 0,
    accessDenied: 0,
    failures: [],
    errors: [],
  };

  const verify = db.prepare(
    `UPDATE products SET hepsiburada_verified_at = CURRENT_TIMESTAMP
     WHERE hepsiburada_sku = ? AND hepsiburada_listing_id = ?`,
  );
  const fail = db.prepare(
    `UPDATE products SET hepsiburada_last_error = ?
     WHERE hepsiburada_sku = ? AND hepsiburada_listing_id = ?`,
  );
  const retry = db.prepare(
    `UPDATE products SET hepsiburada_listing_id = NULL, hepsiburada_sku = NULL,
       hepsiburada_synced_at = NULL WHERE hepsiburada_sku = ? AND hepsiburada_listing_id = ?`,
  );

  for (const { id } of trackings.results) {
    try {
      const items = parseImportStatus(await getImportStatus(id));
      result.checkedTrackings += 1;
      if (items.length === 0 || items.some((item) => item.outcome === "pending")) {
        result.stillPending += 1;
        continue;
      }
      const statements: D1PreparedStatement[] = [];
      for (const item of items) {
        if (item.outcome === "success") {
          statements.push(verify.bind(item.merchantSku, id));
          result.verified += 1;
        } else if (item.outcome === "accessDenied") {
          statements.push(retry.bind(item.merchantSku, id));
          result.accessDenied += 1;
        } else {
          statements.push(fail.bind(item.reason.slice(0, 500), item.merchantSku, id));
          result.failed += 1;
          result.failures.push({ merchantSku: item.merchantSku, reason: item.reason });
        }
      }
      for (let i = 0; i < statements.length; i += 90) {
        await db.batch(statements.slice(i, i + 90));
      }
    } catch (error) {
      result.errors.push(
        `Takip ${id}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
      );
    }
  }
  return result;
}
