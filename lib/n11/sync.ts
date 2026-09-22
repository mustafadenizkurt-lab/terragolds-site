import {
  ensureN11Columns,
  createProduct,
  updateStockAndPrice,
  type N11Product,
  type N11ProductAttribute,
} from "./client";
import { toAbsoluteImageUrl } from "../shopify/client";
import { groupForCategory } from "../category-groups";

type PendingProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  hoverImage: string | null;
  category: string;
  xmlExternalId: string | null;
};

// Trendyol'daki barcodeFor() ile aynı mantık: tedarikçi ürün kodumuz
// (xml_external_id) varsa onu, yoksa kendi id'mizden türetilmiş bir kod
// kullanıyoruz - N11 tarafında stockCode (ve varsa productMainId) olarak
// gönderiliyor.
function stockCodeFor(product: { id: number; xmlExternalId: string | null }): string {
  return product.xmlExternalId || `TG-${product.id}`;
}

// !!! HENÜZ DOLDURULMADI !!!
// Trendyol'daki TRENDYOL_CATEGORY_BY_GROUP_SLUG ile aynı amaç ama N11
// tarafında gerçek kategori ID'lerini bulmak için admin panelinden bir
// "Kategori ara" aracı gerekiyor (bkz. app/admin/n11-sync-panel.tsx +
// /api/admin/n11/categories) - appKey/appSecret girilip N11 API'sine
// gerçek bir istek atılabildiğinde bu tabloyu jewelry alt kategorileriyle
// (Trendyol'daki gibi "... Çelik ..." tercih ederek) dolduracağız. Boşken
// categoryIdFor() bilinçli olarak hata fırlatıyor - sahte/tahmini bir ID
// ile ürün göndermek yanlış kategoride onaysız/reddedilen ürünlere yol
// açabilir (Trendyol'da tam bu yüzden %100 başarısız bir batch yaşanmıştı,
// bkz. sync.ts'teki "Çelik Yüzük" notu).
const N11_CATEGORY_BY_GROUP_SLUG: Record<string, number> = {};

export function categoryIdFor(product: { category: string; name: string }): number {
  const group = groupForCategory(product.category);
  const categoryId = group && N11_CATEGORY_BY_GROUP_SLUG[group.slug];
  if (!categoryId) {
    throw new Error(
      `N11 kategori eşlemesi henüz yapılandırılmamış (grup: ${group?.slug ?? product.category}). ` +
        "Önce N11 senkronu sekmesindeki \"Kategori ara\" aracıyla doğru kategori ID'sini bulup " +
        "lib/n11/sync.ts > N11_CATEGORY_BY_GROUP_SLUG içine ekleyin.",
    );
  }
  return categoryId;
}

// !!! HENÜZ DOLDURULMADI !!!
// Trendyol'daki TRENDYOL_COMMON_ATTRIBUTES/TRENDYOL_EXTRA_ATTRIBUTES_BY_GROUP_SLUG
// ile aynı amaç - N11'in her kategorisinin zorunlu (isMandatory=true)
// özellikleri farklı, gerçek attributeId/valueId'ler admin panelindeki
// "Kategori özellikleri" aracıyla (GET /cdn/category/{id}/attribute) kategori
// eşlemesi netleştikten SONRA bulunup buraya eklenmeli.
function attributesFor(
  _product: { category: string; name: string },
): N11ProductAttribute[] {
  return [];
}

// N11 en fazla kaç görsel kabul ediyor net değil - Trendyol'daki gibi ana
// görsel (image) + hover görseli (hoverImage) sırasıyla gönderiliyor.
function toN11Product(product: PendingProduct): N11Product {
  const imageUrls = [product.image, product.hoverImage]
    .map((url) => (url ? toAbsoluteImageUrl(url) : null))
    .filter((url): url is string => Boolean(url));
  const stockCode = stockCodeFor(product);
  return {
    categoryId: categoryIdFor(product),
    productMainId: stockCode,
    stockCode,
    barcode: stockCode,
    title: product.name,
    // N11 muhtemelen boş açıklamayı reddediyor (Trendyol'da doğrulanmış bir
    // davranış) - D1'de birkaç ürünün açıklaması boş olabileceği için aynı
    // önlem: ürün adına düşülüyor.
    description: product.description.trim() || product.name,
    quantity: product.stock,
    salePrice: product.price,
    listPrice: product.price,
    vatRate: 20,
    currencyType: "TL",
    images: imageUrls.map((url) => ({ url })),
    attributes: attributesFor(product),
  };
}

export type N11SyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// syncProductsToTrendyol/syncProductsToHepsiburada ile aynı desen: yayındaki,
// henüz gönderilmemiş ürünleri bir seferde batchSize kadar gönderir.
// categoryIdFor() eşleme tablosu boşken her ürün için hata fırlatacağı için
// bu fonksiyon kategori eşlemesi doldurulana kadar sadece hata biriktirir -
// bilinçli olarak böyle, yanlış kategoriyle ürün göndermek yerine.
export async function syncProductsToN11(
  db: D1Database,
  batchSize = 25,
): Promise<N11SyncResult> {
  await ensureN11Columns(db);

  const pending = await db
    .prepare(
      `SELECT id, name, description, price, stock, image, hover_image AS hoverImage, category,
              xml_external_id AS xmlExternalId
       FROM products
       WHERE status = 'published' AND n11_task_id IS NULL
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<PendingProduct>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM products WHERE status = 'published' AND n11_task_id IS NULL",
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
    const n11Products = pending.results.map(toN11Product);
    const task = await createProduct(n11Products);
    const taskId = task.taskId ?? task.id ?? "";
    for (const product of pending.results) {
      await db
        .prepare(
          `UPDATE products SET n11_stock_code = ?, n11_task_id = ?,
           n11_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(stockCodeFor(product), taskId, product.id)
        .run();
      created += 1;
    }
  } catch (error) {
    failed = pending.results.length;
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  return { created, failed, remaining: await remainingCount(), errors };
}

// D1 kaynak (source of truth) - Trendyol'daki pushStockAndPriceToTrendyol
// ile aynı prensip (override fiyat kavramı N11 için henüz eklenmedi,
// doğrudan site fiyatı gönderiliyor).
export async function pushStockAndPriceToN11(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureN11Columns(db);

  const product = await db
    .prepare(
      `SELECT price, stock, n11_stock_code AS n11StockCode
       FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<{ price: number; stock: number; n11StockCode: string | null }>();

  if (!product?.n11StockCode) return;

  await updateStockAndPrice([
    {
      stockCode: product.n11StockCode,
      quantity: product.stock,
      salePrice: product.price,
      listPrice: product.price,
    },
  ]);

  await db
    .prepare("UPDATE products SET n11_price_synced = ? WHERE id = ?")
    .bind(product.price, productId)
    .run();
}

export type N11PricePushResult = {
  pushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// pushPendingTrendyolPrices/pushPendingHepsiburadaPrices ile aynı desen:
// D1'de fiyatı/stoku değişmiş ama N11'e henüz yansımamış ürünleri partiler
// hâlinde işler.
export async function pushPendingN11Prices(
  db: D1Database,
  batchSize = 1000,
): Promise<N11PricePushResult> {
  await ensureN11Columns(db);

  const pending = await db
    .prepare(
      `SELECT id, stock, price, n11_stock_code AS n11StockCode
       FROM products
       WHERE n11_stock_code IS NOT NULL
         AND (n11_price_synced IS NULL OR n11_price_synced != price)
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: number; stock: number; price: number; n11StockCode: string }>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM products
         WHERE n11_stock_code IS NOT NULL
           AND (n11_price_synced IS NULL OR n11_price_synced != price)`,
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  if (pending.results.length === 0) {
    return { pushed: 0, failed: 0, remaining: 0, errors: [] };
  }

  try {
    await updateStockAndPrice(
      pending.results.map((row) => ({
        stockCode: row.n11StockCode,
        quantity: row.stock,
        salePrice: row.price,
        listPrice: row.price,
      })),
    );
  } catch (error) {
    return {
      pushed: 0,
      failed: pending.results.length,
      remaining: await remainingCount(),
      errors: [error instanceof Error ? error.message : "bilinmeyen hata"],
    };
  }

  const updateStmt = db.prepare("UPDATE products SET n11_price_synced = ? WHERE id = ?");
  await db.batch(pending.results.map((row) => updateStmt.bind(row.price, row.id)));

  return { pushed: pending.results.length, failed: 0, remaining: await remainingCount(), errors: [] };
}
