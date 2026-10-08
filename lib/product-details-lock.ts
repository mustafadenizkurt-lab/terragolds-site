// Admin, bir ürünün adını/taşını/kategorisini/açıklamasını kendi admin
// panelimizden elle düzelttiğinde (ör. tedarikçi feed'indeki hatalı/eksik bir
// isim ya da yanlış kategori), bu düzeltme bir sonraki XML senkronunda
// (syncSupplier - her 6 saatte bir çalışıyor) tedarikçinin orijinal
// değeriyle EZİLMESİN diye - image_locked_at ile birebir aynı desen (bkz.
// lib/product-image-lock.ts). details_locked_at doluysa syncSupplier() bu
// dört alana hiç dokunmuyor; price/stock/image kendi ayrı kilit
// mekanizmalarını kullanmaya devam ediyor.
export async function ensureDetailsLockColumn(db: D1Database): Promise<void> {
  const columns = await db.prepare("PRAGMA table_info(products)").all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("details_locked_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN details_locked_at TEXT").run();
  }
}
