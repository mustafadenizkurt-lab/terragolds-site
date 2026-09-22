// Admin, bir ürünün ana görselini (image) kendi admin panelimizden elle
// değiştirdiğinde (ör. Trendyol'da pasife alınmasına sebep olan tedarikçi
// kaynaklı logolu/yazılı görseli düzeltmek için), bu görsel bir sonraki XML
// senkronunda (syncSupplier - her 6 saatte bir çalışıyor) tedarikçinin
// ORİJİNAL (düzeltilmemiş) görseliyle ezilmemesi gerekiyor. image_locked_at
// doluysa syncSupplier() o ürünün image alanına hiç dokunmuyor - hover_image
// gibi diğer alanlar normal şekilde güncellenmeye devam ediyor.
export async function ensureImageLockColumn(db: D1Database): Promise<void> {
  const columns = await db.prepare("PRAGMA table_info(products)").all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("image_locked_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN image_locked_at TEXT").run();
  }
}
