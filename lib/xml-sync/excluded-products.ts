// Bir ürün admin panelinden silindiğinde (bkz. app/api/admin/products/[id]/route.ts
// ve .../products/bulk/route.ts), varsa tedarikçi bağlantısı (xml_supplier_id +
// xml_external_id) burada da kaydedilir. syncSupplier/restockSupplierProducts/
// repriceSupplierProducts/backfillHoverImages (lib/xml-sync/syncSupplier.ts) bu
// tabloyu kontrol edip eşleşen (tedarikçi, ürün kodu) çiftini hiç yeniden
// oluşturmuyor/güncellemiyor - satırın kendisi tamamen silinse bile bu koruma
// kalıcı, çünkü ayrı bir tabloda tutuluyor.
//
// Ayrı bir dosyada tutulmasının sebebi: lib/xml-sync/syncSupplier.ts, Shopify/
// Trendyol/Hepsiburada push fonksiyonlarını da import ediyor - admin ürün silme
// route'larının sadece bu iki küçük yardımcı fonksiyon için o ağır import
// grafiğine bağımlı olmasına gerek yok.

export async function loadExcludedExternalIds(
  db: D1Database,
  supplierId: number,
): Promise<Set<string>> {
  const rows = await db
    .prepare(
      "SELECT external_id AS externalId FROM excluded_supplier_products WHERE supplier_id = ?",
    )
    .bind(supplierId)
    .all<{ externalId: string }>();
  return new Set(rows.results.map((row) => row.externalId));
}

export async function excludeSupplierProducts(
  db: D1Database,
  items: { supplierId: number; externalId: string }[],
  excludedBy: number | null,
): Promise<void> {
  if (items.length === 0) return;
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO excluded_supplier_products (supplier_id, external_id, excluded_by) VALUES (?, ?, ?)",
  );
  await db.batch(
    items.map((item) => stmt.bind(item.supplierId, item.externalId, excludedBy)),
  );
}
