// Bir kampanya için elle sabitlenen fiyatın (ör. "Her Şey 50 TL"), bir
// sonraki XML senkronunda (syncSupplier - her 6 saatte bir) tedarikçi
// formülünün hesapladığı fiyatla ezilmemesi için - image_locked_at ile
// birebir aynı desen (bkz. lib/product-image-lock.ts).
//
// Kilit KOŞULSUZ değil: tedarikçi maliyeti (KDV dahil) kilitli fiyatın
// üzerine çıkarsa - yani kilitli fiyatta satmak artık zarar demekse -
// senkron kilidi kendiliğinden açıp ürünü normal formül fiyatına
// döndürüyor (bkz. lib/xml-sync/syncSupplier.ts). "Zarar etmeyelim"
// güvenliği burada devreye giriyor, admin ayrıca takip etmek zorunda kalmıyor.
export async function ensurePriceLockColumn(db: D1Database): Promise<void> {
  const columns = await db.prepare("PRAGMA table_info(products)").all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("price_locked_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN price_locked_at TEXT").run();
  }
}

const VAT_RATE = 0.2;

// cost, D1'de KDV HARİÇ tedarikçi maliyeti olarak tutuluyor (bkz.
// lib/xml-sync/calculatePrice.ts) - kilitli fiyatın hâlâ güvenli olup
// olmadığı KDV dahil maliyetle karşılaştırılıyor.
export function costWithVat(cost: number): number {
  return Math.round(cost * (1 + VAT_RATE));
}
