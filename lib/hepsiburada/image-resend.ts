import { pushHepsiburadaImagesFor } from "./sync";

// Hepsiburada'ya yapılan görsel gönderimlerinin bir kısmı Hepsiburada'da
// uygulanmadı (bazı ürünlerde yeni görsel göründü, bazılarında eski kaldı -
// bkz. verify-images'ta "Can not update product in matched or in catalog
// progress status"). Admin'in isteğiyle görseli değiştirilmiş TÜM ürünler
// SADECE Hepsiburada için yeniden gönderim sırasına alınıyor (Trendyol/N11'e
// tekrar gitmez). hb_images_resent_at: bu sıradan en son ne zaman gönderildi.
// Sıra 6 saatlik cron'da ve /api/admin/hepsiburada/resend-images ile eriyor.
export async function ensureHepsiburadaImageResendColumn(db: D1Database): Promise<void> {
  const columns = await db.prepare("PRAGMA table_info(products)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "hb_images_resent_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN hb_images_resent_at TEXT").run();
  }
}

const PENDING_WHERE = `status != 'deleted' AND images_changed_at IS NOT NULL
  AND hepsiburada_listing_id IS NOT NULL AND hepsiburada_last_error IS NULL
  AND (hb_images_resent_at IS NULL OR hb_images_resent_at < images_changed_at)`;

export async function resendHepsiburadaImages(
  db: D1Database,
  limit = 200,
): Promise<{ attempted: number; sent: number; remaining: number; error: string | null }> {
  await ensureHepsiburadaImageResendColumn(db);
  const rows = await db
    .prepare(`SELECT id FROM products WHERE ${PENDING_WHERE} ORDER BY images_changed_at DESC LIMIT ?`)
    .bind(Math.max(1, Math.min(limit, 400)))
    .all<{ id: number }>();
  const ids = rows.results.map((row) => row.id);
  let sent = 0;
  let error: string | null = null;
  if (ids.length > 0) {
    try {
      const result = await pushHepsiburadaImagesFor(db, ids);
      sent = result.sent;
      const stmt = db.prepare(
        `UPDATE products SET hb_images_resent_at = CURRENT_TIMESTAMP,
           images_push_refs = json_set(COALESCE(images_push_refs, '{}'), '$.hepsiburada', ?)
         WHERE id = ?`,
      );
      const markStmt = db.prepare("UPDATE products SET hb_images_resent_at = CURRENT_TIMESTAMP WHERE id = ?");
      const statements = ids.map((id) =>
        result.refsById[id] ? stmt.bind(result.refsById[id], id) : markStmt.bind(id),
      );
      for (let offset = 0; offset < statements.length; offset += 100) {
        await db.batch(statements.slice(offset, offset + 100));
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "bilinmeyen hata";
    }
  }
  const remaining = await db
    .prepare(`SELECT COUNT(*) AS n FROM products WHERE ${PENDING_WHERE}`)
    .first<{ n: number }>();
  return { attempted: ids.length, sent, remaining: Number(remaining?.n ?? 0), error };
}
