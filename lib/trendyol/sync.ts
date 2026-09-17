import { ensureTrendyolColumns, createProduct, updateStockAndPrice, type TrendyolProduct } from "./client";
import { toAbsoluteImageUrl } from "../shopify/client";

type PendingProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  xmlExternalId: string | null;
};

// Trendyol her ürün için barkod zorunlu tutuyor - tedarikçi ürün kodumuz
// (xml_external_id) varsa onu kullanıyoruz, yoksa kendi id'mizden türetilmiş
// bir kod (yerel ürünler ve elle eklenenler için).
function barcodeFor(product: { id: number; xmlExternalId: string | null }): string {
  return product.xmlExternalId || `TG-${product.id}`;
}

// GEÇİCİ VARSAYILAN: Trendyol'un kendi kategori ağacında admin panelindeki
// "Kategori ara" ile bulunan "Aksesuar > Takı & Mücevher > Kolye > Çelik
// Kolye" ID'si. Şu an TÜM ürünler bu tek kategoriye gönderiliyor - bu sadece
// ilk canlı testi (auth/header/brandId sorunlarını ayıklamak için) mümkün
// kılmak amaçlı bir geçici çözüm. Gerçek kullanımda her site kategorisinin
// (lib/category-groups.ts) kendi Trendyol categoryId'sine eşlenmesi gerekir.
const TRENDYOL_DEFAULT_CATEGORY_ID = 2853;

// Trendyol markasız ürün kabul etmiyor - admin panelindeki "Marka ara" ile
// bulunan, tescilli marka bekletmeyen "Genel Markalar" kaydının ID'si.
const TRENDYOL_DEFAULT_BRAND_ID = 1041874;

function toTrendyolProduct(product: PendingProduct): TrendyolProduct {
  const imageUrl = toAbsoluteImageUrl(product.image);
  return {
    barcode: barcodeFor(product),
    title: product.name,
    productMainId: barcodeFor(product),
    brandId: TRENDYOL_DEFAULT_BRAND_ID,
    categoryId: TRENDYOL_DEFAULT_CATEGORY_ID,
    quantity: product.stock,
    stockCode: barcodeFor(product),
    listPrice: product.price,
    salePrice: product.price,
    description: product.description,
    images: imageUrl ? [{ url: imageUrl }] : [],
    vatRate: 20,
  };
}

export type TrendyolSyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// syncProductsToShopify (lib/shopify/sync.ts) ile aynı desen: yayındaki,
// henüz gönderilmemiş ürünleri bir seferde batchSize kadar gönderir.
// Trendyol'un create endpoint'i tek çağrıda birden fazla ürün kabul ettiği
// için (Shopify'ın aksine, tek tek istemek yerine) tüm parti tek bir
// createProduct() çağrısıyla gönderiliyor - kısmi başarı/başarısızlık
// getBatchRequestResult() ile ayrıca sorgulanabilir (bkz. client.ts),
// bu ilk sürüm şimdilik tüm partiyi tek sonuç olarak işliyor.
export async function syncProductsToTrendyol(
  db: D1Database,
  batchSize = 25,
): Promise<TrendyolSyncResult> {
  await ensureTrendyolColumns(db);

  const pending = await db
    .prepare(
      `SELECT id, name, description, price, stock, image,
              xml_external_id AS xmlExternalId
       FROM products
       WHERE status = 'published' AND trendyol_listing_id IS NULL
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<PendingProduct>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM products WHERE status = 'published' AND trendyol_listing_id IS NULL",
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
    const trendyolProducts = pending.results.map(toTrendyolProduct);
    const { batchRequestId } = await createProduct(trendyolProducts);
    for (const product of pending.results) {
      await db
        .prepare(
          `UPDATE products SET trendyol_barcode = ?, trendyol_listing_id = ?,
           trendyol_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(barcodeFor(product), batchRequestId, product.id)
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
  stock: number;
  trendyolBarcode: string | null;
};

// D1 kaynak (source of truth) - Shopify'daki pushInventoryToShopify/
// pushPriceToShopify ile aynı prensip, tek farkla: Trendyol stok ve fiyatı
// tek bir endpoint'te (updateStockAndPrice) birlikte istiyor, bu yüzden
// burada da tek fonksiyonda birleşik.
export async function pushStockAndPriceToTrendyol(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureTrendyolColumns(db);

  const product = await db
    .prepare(
      `SELECT price, stock, trendyol_barcode AS trendyolBarcode
       FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<StockPriceRow>();

  // Henüz Trendyol'a hiç gönderilmemiş (veya hiç gönderilmeyecek, örn. bir
  // taslak ürün) - gönderilecek bir şey yok. syncProductsToTrendyol() ilk
  // oluşturulduğunda zaten güncel stok/fiyatla gönderir.
  if (!product?.trendyolBarcode) return;

  await updateStockAndPrice([
    {
      barcode: product.trendyolBarcode,
      quantity: product.stock,
      salePrice: product.price,
      listPrice: product.price,
    },
  ]);

  await db
    .prepare("UPDATE products SET trendyol_price_synced = ? WHERE id = ?")
    .bind(product.price, productId)
    .run();
}

export type TrendyolPricePushResult = {
  pushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// pushPendingShopifyPrices (lib/shopify/price.ts) ile aynı desen: bir
// tedarikçinin toplu yeniden fiyatlandırması gibi durumlarda satır satır
// değil, D1'de fiyatı değişmiş ama Trendyol'a henüz yansımamış ürünleri
// partiler hâlinde işler. `remaining` 0 olana kadar tekrar çağrılabilir.
export async function pushPendingTrendyolPrices(
  db: D1Database,
  batchSize = 25,
): Promise<TrendyolPricePushResult> {
  await ensureTrendyolColumns(db);

  const pending = await db
    .prepare(
      `SELECT id FROM products
       WHERE trendyol_barcode IS NOT NULL
         AND (trendyol_price_synced IS NULL OR trendyol_price_synced != price)
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: number }>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM products
         WHERE trendyol_barcode IS NOT NULL
           AND (trendyol_price_synced IS NULL OR trendyol_price_synced != price)`,
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const row of pending.results) {
    try {
      await pushStockAndPriceToTrendyol(db, row.id);
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
