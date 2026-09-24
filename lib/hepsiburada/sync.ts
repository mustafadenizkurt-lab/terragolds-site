import { ensureHepsiburadaColumns, createProduct, updateStockAndPrice, type HepsiburadaProduct } from "./client";
import { toAbsoluteImageUrl } from "../shopify/client";

type PendingProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  hepsiburadaOverridePrice: number | null;
  stock: number;
  image: string;
  xmlExternalId: string | null;
};

// Hepsiburada her ürün için bir merchantSku (bizim kendi ürün kodumuz)
// zorunlu tutuyor - tedarikçi ürün kodumuz (xml_external_id) varsa onu
// kullanıyoruz, yoksa kendi id'mizden türetilmiş bir kod.
function merchantSkuFor(product: { id: number; xmlExternalId: string | null }): string {
  return product.xmlExternalId || `TG-${product.id}`;
}

// NOT (bilinen eksik - lib/trendyol/sync.ts'teki ile aynı durum): Hepsiburada
// her üründe geçerli bir kategori ID bekliyor (kendi kategori ağacından).
// categoryId burada boş string ile dolduruluyor; gerçek senkron çalışmadan
// önce site kategorilerimizi Hepsiburada'nın kategori ağacına eşleyen bir
// yapı eklenmesi gerekecek.
function toHepsiburadaProduct(product: PendingProduct): HepsiburadaProduct {
  const imageUrl = toAbsoluteImageUrl(product.image);
  return {
    merchantSku: merchantSkuFor(product),
    productName: product.name,
    categoryId: "",
    brand: "Terragolds",
    // Site fiyatından bağımsız, komisyon sonrası hedef kâr marjını koruyan
    // hepsiburada_override_price varsa o kullanılır (bkz.
    // lib/hepsiburada/pricing.ts), yoksa site fiyatına düşer.
    price: product.hepsiburadaOverridePrice ?? product.price,
    availableStock: product.stock,
    description: product.description,
    images: imageUrl ? [imageUrl] : [],
    vatRate: 20,
  };
}

export type HepsiburadaSyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// syncProductsToShopify/syncProductsToTrendyol ile aynı desen: yayındaki,
// henüz gönderilmemiş ürünleri bir seferde batchSize kadar gönderir.
export async function syncProductsToHepsiburada(
  db: D1Database,
  batchSize = 25,
): Promise<HepsiburadaSyncResult> {
  await ensureHepsiburadaColumns(db);

  const pending = await db
    .prepare(
      `SELECT id, name, description, price,
              hepsiburada_override_price AS hepsiburadaOverridePrice,
              stock, image, xml_external_id AS xmlExternalId
       FROM products
       WHERE status = 'published' AND hepsiburada_listing_id IS NULL
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<PendingProduct>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM products WHERE status = 'published' AND hepsiburada_listing_id IS NULL",
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  if (pending.results.length === 0) {
    return { created: 0, failed: 0, remaining: 0, errors: [] };
  }

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  try {
    const hepsiburadaProducts = pending.results.map(toHepsiburadaProduct);
    const { trackingId } = await createProduct(hepsiburadaProducts);
    for (const product of pending.results) {
      await db
        .prepare(
          `UPDATE products SET hepsiburada_sku = ?, hepsiburada_listing_id = ?,
           hepsiburada_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(merchantSkuFor(product), trackingId, product.id)
        .run();
      created += 1;
    }
  } catch (error) {
    failed = pending.results.length;
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  return { created, failed, remaining: await remainingCount(), errors };
}

type StockPriceRow = {
  price: number;
  hepsiburadaOverridePrice: number | null;
  stock: number;
  hepsiburadaSku: string | null;
};

// D1 kaynak (source of truth) - pushStockAndPriceToTrendyol ile aynı
// prensip: Hepsiburada da stok ve fiyatı tek bir endpoint'te birlikte
// istiyor. hepsiburada_override_price varsa (bkz. lib/hepsiburada/
// pricing.ts) site fiyatı yerine o gönderilir - hepsiburada_price_synced de
// karşılaştırma tutarlı kalsın diye her zaman GERÇEKTEN gönderilen
// (efektif) fiyatı tutar.
export async function pushStockAndPriceToHepsiburada(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureHepsiburadaColumns(db);

  const product = await db
    .prepare(
      `SELECT price, hepsiburada_override_price AS hepsiburadaOverridePrice,
              stock, hepsiburada_sku AS hepsiburadaSku
       FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<StockPriceRow>();

  // Henüz Hepsiburada'ya hiç gönderilmemiş - gönderilecek bir şey yok.
  // syncProductsToHepsiburada() ilk oluşturulduğunda zaten güncel
  // stok/fiyatla gönderir.
  if (!product?.hepsiburadaSku) return;

  const effectivePrice = product.hepsiburadaOverridePrice ?? product.price;
  await updateStockAndPrice([
    {
      merchantSku: product.hepsiburadaSku,
      availableStock: product.stock,
      price: effectivePrice,
    },
  ]);

  await db
    .prepare("UPDATE products SET hepsiburada_price_synced = ? WHERE id = ?")
    .bind(effectivePrice, productId)
    .run();
}

export type HepsiburadaPricePushResult = {
  pushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// pushPendingTrendyolPrices ile aynı desen: bir tedarikçinin toplu yeniden
// fiyatlandırması gibi durumlarda satır satır değil, D1'de fiyatı değişmiş
// ama Hepsiburada'ya henüz yansımamış ürünleri partiler hâlinde işler.
export async function pushPendingHepsiburadaPrices(
  db: D1Database,
  batchSize = 25,
): Promise<HepsiburadaPricePushResult> {
  await ensureHepsiburadaColumns(db);

  // hepsiburada_override_price varsa (bkz. lib/hepsiburada/pricing.ts)
  // hedef fiyat odur - drift tespiti her zaman bu EFEKTİF fiyata göre
  // yapılmalı, yoksa override uygulanmış bir ürün site fiyatı değişmediği
  // sürece hiç yeniden gönderilmez sanılır.
  const pending = await db
    .prepare(
      `SELECT id FROM products
       WHERE hepsiburada_sku IS NOT NULL
         AND (hepsiburada_price_synced IS NULL OR hepsiburada_price_synced != COALESCE(hepsiburada_override_price, price))
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: number }>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM products
         WHERE hepsiburada_sku IS NOT NULL
           AND (hepsiburada_price_synced IS NULL OR hepsiburada_price_synced != COALESCE(hepsiburada_override_price, price))`,
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const row of pending.results) {
    try {
      await pushStockAndPriceToHepsiburada(db, row.id);
      pushed += 1;
    } catch (error) {
      failed += 1;
      errors.push(
        `#${row.id}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
      );
    }
  }

  return { pushed, failed, remaining: await remainingCount(), errors };
}
