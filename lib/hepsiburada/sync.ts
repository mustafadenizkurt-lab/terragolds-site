import {
  ensureHepsiburadaColumns,
  getProducts,
  importProductsFile,
  updateStockAndPrice,
} from "./client";
import { getHepsiburadaCredentials } from "./auth";
import { buildImportItem, hepsiburadaCategoryFor, isMaleProduct, type HepsiburadaImportItem } from "./attributes";
import { toAbsoluteImageUrl } from "../image-url";
import { selectByIds } from "../d1-chunks";

// Hepsiburada her ürün için bir merchantSku (bizim kendi ürün kodumuz)
// zorunlu tutuyor - tedarikçi ürün kodumuz (xml_external_id) varsa onu
// kullanıyoruz, yoksa kendi id'mizden türetilmiş bir kod.
function merchantSkuFor(product: { id: number; xmlExternalId: string | null }): string {
  return product.xmlExternalId || `TG-${product.id}`;
}

export type HepsiburadaSyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// Yayındaki, henüz gönderilmemiş ürünleri GERÇEK Hepsiburada şemasıyla
// (kategori + zorunlu özellikler, multipart içe aktarma) gönderir. trackingId
// hepsiburada_listing_id'ye yazılır AMA bu kabul demek değil - sonuç
// reconcileHepsiburadaImports ile doğrulanır. Kategori karşılığı olmayan
// ürünler (Şahmeran, Saat...) hepsiburada_last_error ile işaretlenip
// tekrar tekrar denenmez.
export async function syncProductsToHepsiburada(
  db: D1Database,
  batchSize = 25,
): Promise<HepsiburadaSyncResult> {
  await ensureHepsiburadaColumns(db);
  const pendingWhere =
    "status = 'published' AND hepsiburada_listing_id IS NULL AND hepsiburada_last_error IS NULL";

  const remainingCount = async () => {
    const row = await db
      .prepare(`SELECT COUNT(*) AS c FROM products WHERE ${pendingWhere}`)
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  const pending = await db
    .prepare(
      `SELECT id, name, COALESCE(NULLIF(seo_description, ''), description) AS description,
              price, hepsiburada_override_price AS overridePrice, stock,
              image, hover_image AS hoverImage, image3, image4, category, xml_external_id AS xmlExternalId
       FROM products WHERE ${pendingWhere} ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<{
      id: number;
      name: string;
      description: string;
      price: number;
      overridePrice: number | null;
      stock: number;
      image: string;
      hoverImage: string | null;
      image3?: string | null;
      image4?: string | null;
      category: string;
      xmlExternalId: string | null;
    }>();
  if (pending.results.length === 0) return { created: 0, failed: 0, remaining: 0, errors: [] };

  const errors: string[] = [];
  let failed = 0;
  try {
    const { merchantId } = await getHepsiburadaCredentials();
    const items: HepsiburadaImportItem[] = [];
    const sent: typeof pending.results = [];
    const unmapped: number[] = [];
    for (const row of pending.results) {
      const categoryId = hepsiburadaCategoryFor(row);
      if (!categoryId) {
        unmapped.push(row.id);
        continue;
      }
      items.push(
        buildImportItem({
          merchantId,
          categoryId,
          productId: row.id,
          price: row.overridePrice ?? row.price,
          stock: row.stock,
          merchantSku: merchantSkuFor(row),
          title: row.name,
          description: row.description?.trim() || row.name,
          images: [row.image, row.hoverImage, row.image3, row.image4]
            .map((url) => (url ? toAbsoluteImageUrl(url) : null))
            .filter((url): url is string => Boolean(url)),
          male: isMaleProduct(row),
        }),
      );
      sent.push(row);
    }
    if (unmapped.length > 0) {
      const stmt = db.prepare("UPDATE products SET hepsiburada_last_error = ? WHERE id = ?");
      await db.batch(
        unmapped.map((id) => stmt.bind("Hepsiburada kategori eşlemesi yok (Şahmeran/Saat vb.)", id)),
      );
    }
    let created = 0;
    if (items.length > 0) {
      const result = await importProductsFile(items);
      const parsed = JSON.parse(result.body || "{}") as { data?: { trackingId?: string } };
      const trackingId = parsed.data?.trackingId;
      if (result.status !== 200 || !trackingId) {
        throw new Error(`Hepsiburada içe aktarma başarısız (${result.status}): ${result.body.slice(0, 300)}`);
      }
      const stmt = db.prepare(
        `UPDATE products SET hepsiburada_sku = ?, hepsiburada_listing_id = ?,
           hepsiburada_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
      );
      await db.batch(sent.map((row) => stmt.bind(merchantSkuFor(row), trackingId, row.id)));
      created = sent.length;
    }
    return { created, failed, remaining: await remainingCount(), errors };
  } catch (error) {
    failed = pending.results.length;
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
    return { created: 0, failed, remaining: await remainingCount(), errors };
  }
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
      try {
        await pushStockAndPriceToHepsiburada(db, row.id);
      } catch (error) {
        // "exceeds his inventory upload limit" (429) - Hepsiburada aynı anda
        // en fazla 5 bekleyen listing güncellemesine izin veriyor. Bir kez
        // kısa bir bekleme sonrası yeniden deniyoruz, çoğu zaman önceki
        // istekler bu sürede tamamlanmış oluyor.
        if (error instanceof Error && /429|upload limit/i.test(error.message)) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await pushStockAndPriceToHepsiburada(db, row.id);
        } else {
          throw error;
        }
      }
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

export type HepsiburadaStockMismatch = {
  id: number;
  name: string;
  hepsiburadaSku: string;
  d1Stock: number;
  hepsiburadaStock: number;
};

export type HepsiburadaStockAuditResult = {
  checked: number;
  mismatches: HepsiburadaStockMismatch[];
  // Hepsiburada'nın 0 dediği ama D1'in pozitif tuttuğu, en riskli alt küme -
  // bunlar fiilen tükenmiş olup bizim hâlâ "stokta" sandığımız ürünler
  // (ör. TG-3911 - admin panelinden elle girilmiş, tedarikçi senkronunun
  // hiç izlemediği ürünler). apply=true ise bu satırlar D1'de 0'a çekilir.
  outOfStockAtHepsiburada: HepsiburadaStockMismatch[];
  applied: number;
  error: string | null;
  // Sadece ayrıştırma başarısız olduğunda dolu - gerçek yanıtın şeklini
  // (hangi anahtar altında dizi geldiğini, bir örnek satırın alan adlarını)
  // gösterir, bir sonraki düzeltmenin tahmin değil gerçek veriye dayanması için.
  debugRawShape?: { topLevelKeys: string[]; sampleItemKeys?: string[] };
};

const HEPSIBURADA_LISTING_PAGE_SIZE = 1000;
const HEPSIBURADA_LISTING_MAX_PAGES = 20; // güvenlik sınırı, ~20000 listing'e kadar

const LISTING_ARRAY_KEYS = ["items", "listing", "listings", "content", "data", "products", "result", "results"];
const SKU_FIELD_CANDIDATES = ["merchantSku", "MerchantSku", "sku", "Sku", "hepsiburadaSku", "HepsiburadaSku"];
const STOCK_FIELD_CANDIDATES = [
  "availableStock",
  "AvailableStock",
  "stock",
  "Stock",
  "quantity",
  "Quantity",
];

function findListingArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const key of LISTING_ARRAY_KEYS) {
      const value = (raw as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return null;
}

function readField(item: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of candidates) {
    if (item[key] !== undefined) return item[key];
  }
  return undefined;
}

// Hepsiburada'nın GERÇEK (canlı) listeleme API'sinden okuduğu stokla D1'i
// karşılaştırır - pushPendingHepsiburadaPrices gibi push mekanizmaları
// sadece D1 -> Hepsiburada yönünü garanti ediyor; bu, tersini (Hepsiburada'da
// ne olduğunu) doğrudan sorguluyor. Özellikle tedarikçi feed'ine hiç
// bağlanmamış ("manual") ürünlerde D1 stoğu hiçbir otomasyonla
// güncellenmiyor, bu yüzden D1 ile gerçek (Hepsiburada'nın bildiği) durum
// zamanla ayrışabiliyor.
export async function auditHepsiburadaStock(
  db: D1Database,
  apply: boolean,
): Promise<HepsiburadaStockAuditResult> {
  await ensureHepsiburadaColumns(db);

  const liveStockBySku = new Map<string, number>();
  try {
    let offset = 0;
    for (let page = 0; page < HEPSIBURADA_LISTING_MAX_PAGES; page += 1) {
      const raw = await getProducts({ offset, limit: HEPSIBURADA_LISTING_PAGE_SIZE });
      const items = findListingArray(raw);
      if (items === null) {
        const topLevelKeys =
          raw && typeof raw === "object" ? Object.keys(raw as Record<string, unknown>) : [];
        return {
          checked: 0,
          mismatches: [],
          outOfStockAtHepsiburada: [],
          applied: 0,
          error: "Hepsiburada yanıtında ürün dizisi bulunamadı (beklenen anahtarlardan hiçbiri yok).",
          debugRawShape: { topLevelKeys },
        };
      }
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const sku = readField(item as Record<string, unknown>, SKU_FIELD_CANDIDATES);
        const stock = readField(item as Record<string, unknown>, STOCK_FIELD_CANDIDATES);
        if (typeof sku !== "string" || typeof stock !== "number") {
          return {
            checked: 0,
            mismatches: [],
            outOfStockAtHepsiburada: [],
            applied: 0,
            error: "Hepsiburada ürün satırında beklenen sku/stok alanı bulunamadı.",
            debugRawShape: { topLevelKeys: [], sampleItemKeys: Object.keys(item as Record<string, unknown>) },
          };
        }
        liveStockBySku.set(sku, stock);
      }
      if (items.length < HEPSIBURADA_LISTING_PAGE_SIZE) break;
      offset += HEPSIBURADA_LISTING_PAGE_SIZE;
    }
  } catch (error) {
    return {
      checked: 0,
      mismatches: [],
      outOfStockAtHepsiburada: [],
      applied: 0,
      error: error instanceof Error ? error.message : "Hepsiburada listeleme sorgusu başarısız.",
    };
  }

  const rows = await db
    .prepare(
      `SELECT id, name, stock, hepsiburada_sku AS hepsiburadaSku
       FROM products WHERE hepsiburada_sku IS NOT NULL`,
    )
    .all<{ id: number; name: string; stock: number; hepsiburadaSku: string }>();

  const mismatches: HepsiburadaStockMismatch[] = [];
  const outOfStockAtHepsiburada: HepsiburadaStockMismatch[] = [];
  for (const row of rows.results) {
    const hepsiburadaStock = liveStockBySku.get(row.hepsiburadaSku);
    if (hepsiburadaStock === undefined || hepsiburadaStock === row.stock) continue;
    const entry: HepsiburadaStockMismatch = {
      id: row.id,
      name: row.name,
      hepsiburadaSku: row.hepsiburadaSku,
      d1Stock: row.stock,
      hepsiburadaStock,
    };
    mismatches.push(entry);
    if (hepsiburadaStock === 0 && row.stock > 0) outOfStockAtHepsiburada.push(entry);
  }

  let applied = 0;
  if (apply && outOfStockAtHepsiburada.length > 0) {
    const updateStmt = db.prepare(
      "UPDATE products SET stock = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    );
    await db.batch(outOfStockAtHepsiburada.map((entry) => updateStmt.bind(entry.id)));
    applied = outOfStockAtHepsiburada.length;
  }

  return { checked: rows.results.length, mismatches, outOfStockAtHepsiburada, applied, error: null };
}

export type HepsiburadaTitleRefreshResult = {
  updated: number;
  remaining: number;
  batches: { status: number; itemCount: number }[];
  errors: string[];
};

// Tedarikçinin pirinçten çeliğe geçmesiyle düzeltilen ürün adlarını (bkz.
// lib/xml-sync/material-correction.ts) zaten Hepsiburada'ya gönderilmiş
// ürünlere yeniden gönderir - refreshTrendyolTitles/refreshN11Titles ile
// aynı amaç. Hepsiburada'da güncelleme de aynı import endpoint'i üzerinden
// merchantSku eşleştirmesiyle yapılıyor (bkz. client.ts > updateProduct
// yorumu), yani syncProductsToHepsiburada'daki GERÇEK, doğrulanmış
// importProductsFile çağrısı tekrar kullanılıyor. hepsiburada_last_error
// dolu ürünler hariç - onlarda kategori eşlemesi zaten yok.
export async function refreshHepsiburadaTitles(
  db: D1Database,
  batchSize = 100,
): Promise<HepsiburadaTitleRefreshResult> {
  await ensureHepsiburadaColumns(db);
  const pending = await db
    .prepare(
      `SELECT id, name, COALESCE(NULLIF(seo_description, ''), description) AS description,
              price, hepsiburada_override_price AS overridePrice, stock,
              image, hover_image AS hoverImage, image3, image4, category, xml_external_id AS xmlExternalId
       FROM products
       WHERE hepsiburada_listing_id IS NOT NULL AND hepsiburada_last_error IS NULL
       ORDER BY id`,
    )
    .all<{
      id: number;
      name: string;
      description: string;
      price: number;
      overridePrice: number | null;
      stock: number;
      image: string;
      hoverImage: string | null;
      image3?: string | null;
      image4?: string | null;
      category: string;
      xmlExternalId: string | null;
    }>();

  const batches: { status: number; itemCount: number }[] = [];
  const errors: string[] = [];
  let updated = 0;
  const { merchantId } = await getHepsiburadaCredentials();

  for (let offset = 0; offset < pending.results.length; offset += batchSize) {
    // Peş peşe import çağrıları (gerçek denemede 2. batch'ten sonra)
    // Hepsiburada'nın WAF'ını ("Hepsiburada | Güvenlik" HTML sayfası, 403)
    // tetikliyor - diğer tek seferlik senkronlarda hiç görülmedi çünkü
    // onlar tek bir import çağrısı yapıyor, bu fonksiyon ise arka arkaya
    // birden çok çağrı yapan ilk fonksiyon. Batch'ler arasına kısa bir
    // bekleme eklemek bunu önlüyor.
    if (offset > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
    const chunk = pending.results.slice(offset, offset + batchSize);
    try {
      const items: HepsiburadaImportItem[] = chunk.map((row) => {
        const categoryId = hepsiburadaCategoryFor(row);
        if (!categoryId) {
          throw new Error(`#${row.id}: Hepsiburada kategori eşlemesi yok`);
        }
        return buildImportItem({
          merchantId,
          categoryId,
          productId: row.id,
          price: row.overridePrice ?? row.price,
          stock: row.stock,
          merchantSku: merchantSkuFor(row),
          title: row.name,
          description: row.description?.trim() || row.name,
          images: [row.image, row.hoverImage, row.image3, row.image4]
            .map((url) => (url ? toAbsoluteImageUrl(url) : null))
            .filter((url): url is string => Boolean(url)),
          male: isMaleProduct(row),
        });
      });
      let result = await importProductsFile(items);
      if (result.status === 403) {
        // WAF bloğu geçici - 5 sn bekleyip bir kez daha dene.
        await new Promise((resolve) => setTimeout(resolve, 5000));
        result = await importProductsFile(items);
      }
      if (result.status !== 200) {
        throw new Error(`Hepsiburada içe aktarma başarısız (${result.status}): ${result.body.slice(0, 300)}`);
      }
      batches.push({ status: result.status, itemCount: chunk.length });
      updated += chunk.length;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
      return { updated, remaining: pending.results.length - updated, batches, errors };
    }
  }
  return { updated, remaining: 0, batches, errors };
}

// Deneme: verilen stok kodlarındaki ürünleri Hepsiburada'ya GERÇEK şemayla
// (kategori + zorunlu özellikler, multipart içe aktarma) gönderir ve ham
// yanıtı döner. D1'e HİÇBİR ŞEY yazmaz - şema doğrulanana kadar küçük
// denemeler için.
export async function importHepsiburadaTest(
  db: D1Database,
  stockCodes: string[],
  importPath?: string,
  userAgentOverride?: string,
  experiment?: { categoryId?: number; omitBarcode?: boolean; packageImage?: boolean },
): Promise<{ sent: number; skipped: string[]; status: number; body: string; headers?: Record<string, string>; items: unknown[] }> {
  const codes = stockCodes.slice(0, 5);
  const rows = await db
    .prepare(
      `SELECT id, name, COALESCE(NULLIF(seo_description, ''), description) AS description,
              price, hepsiburada_override_price AS overridePrice, stock,
              image, hover_image AS hoverImage, image3, image4, category, xml_external_id AS xmlExternalId
       FROM products WHERE xml_external_id IN (${codes.map(() => "?").join(",")})`,
    )
    .bind(...codes)
    .all<{
      id: number;
      name: string;
      description: string;
      price: number;
      overridePrice: number | null;
      stock: number;
      image: string;
      hoverImage: string | null;
      image3?: string | null;
      image4?: string | null;
      category: string;
      xmlExternalId: string | null;
    }>();
  const { merchantId } = await getHepsiburadaCredentials();
  const skipped: string[] = [];
  const items: HepsiburadaImportItem[] = [];
  for (const row of rows.results) {
    const categoryId = hepsiburadaCategoryFor(row);
    if (!categoryId) {
      skipped.push(row.xmlExternalId ?? String(row.id));
      continue;
    }
    items.push(
      buildImportItem({
        merchantId,
        categoryId,
        productId: row.id,
        price: row.overridePrice ?? row.price,
        stock: row.stock,
        merchantSku: merchantSkuFor(row),
        title: row.name,
        description: row.description?.trim() || row.name,
        images: [row.image, row.hoverImage, row.image3, row.image4]
          .map((url) => (url ? toAbsoluteImageUrl(url) : null))
          .filter((url): url is string => Boolean(url)),
        male: isMaleProduct(row),
      }),
    );
  }
  if (items.length === 0) return { sent: 0, skipped, status: 0, body: "", items };
  // Erişim deneyi: kategoriyi ez ve/veya Barcode'u çıkar (zorunlu alan eksik
  // olduğu için ürün OLUŞMAZ ama doğrulama mesajı erişimin var olup olmadığını
  // gösterir: "Access denied" mağaza düzeyi, doğrulama hatası kategori/gövde).
  for (const item of items) {
    if (experiment?.categoryId) item.categoryId = experiment.categoryId;
    if (experiment?.omitBarcode) delete item.attributes.Barcode;
    // Test (SIT) kategorilerinde "Paket Görseli (ön)" (00000MU, media) zorunlu.
    if (experiment?.packageImage) item.attributes["00000MU"] = item.attributes.Image1;
  }
  const result = await importProductsFile(items, importPath, userAgentOverride);
  return { sent: items.length, skipped, status: result.status, body: result.body, headers: result.headers, items };
}

// Admin panelinden görseli değiştirilen ürünlerin (bkz. lib/marketplace-images.ts)
// TÜM görsellerini Hepsiburada'ya gönderir. Hepsiburada'da güncelleme de
// içe aktarma (import) üzerinden merchantSku eşleşmesiyle yapılıyor - bkz.
// refreshHepsiburadaTitles; aynı doğrulanmış gövde, Image1..Image4 ile.
export async function pushHepsiburadaImagesFor(
  db: D1Database,
  productIds: number[],
): Promise<{ sent: number; refsById: Record<number, string> }> {
  await ensureHepsiburadaColumns(db);
  if (productIds.length === 0) return { sent: 0, refsById: {} };
  const rows = await selectByIds<{
    id: number;
    name: string;
    description: string;
    price: number;
    overridePrice: number | null;
    stock: number;
    image: string;
    hoverImage: string | null;
    image3: string | null;
    image4: string | null;
    category: string;
    xmlExternalId: string | null;
  }>(
    db,
    productIds,
    (placeholders) =>
      `SELECT id, name, COALESCE(NULLIF(seo_description, ''), description) AS description,
              price, hepsiburada_override_price AS overridePrice, stock,
              image, hover_image AS hoverImage, image3, image4, category, xml_external_id AS xmlExternalId
       FROM products
       WHERE id IN (${placeholders}) AND hepsiburada_listing_id IS NOT NULL AND hepsiburada_last_error IS NULL`,
  );
  const mapped = rows.filter((row) => hepsiburadaCategoryFor(row) !== null);
  if (mapped.length === 0) return { sent: 0, refsById: {} };
  const { merchantId } = await getHepsiburadaCredentials();
  let sent = 0;
  const refsById: Record<number, string> = {};
  for (let offset = 0; offset < mapped.length; offset += 100) {
    // Peş peşe import çağrıları Hepsiburada'nın WAF'ını tetikleyebiliyor -
    // bkz. refreshHepsiburadaTitles.
    if (offset > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
    const items: HepsiburadaImportItem[] = mapped.slice(offset, offset + 100).map((row) =>
      buildImportItem({
        merchantId,
        categoryId: hepsiburadaCategoryFor(row)!,
        productId: row.id,
        price: row.overridePrice ?? row.price,
        stock: row.stock,
        merchantSku: merchantSkuFor(row),
        title: row.name,
        description: row.description?.trim() || row.name,
        images: [row.image, row.hoverImage, row.image3, row.image4]
          .map((url) => (url ? toAbsoluteImageUrl(url) : null))
          .filter((url): url is string => Boolean(url)),
        male: isMaleProduct(row),
      }),
    );
    let result = await importProductsFile(items);
    if (result.status === 403) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      result = await importProductsFile(items);
    }
    if (result.status !== 200) {
      throw new Error(`Hepsiburada içe aktarma başarısız (${result.status}): ${result.body.slice(0, 300)}`);
    }
    // trackingId sonradan /api/admin/marketplace/verify-images ile içe
    // aktarmanın gerçek sonucunu sorgulamak için saklanıyor.
    const trackingId = (JSON.parse(result.body || "{}") as { data?: { trackingId?: string } }).data?.trackingId;
    if (trackingId) {
      for (const row of mapped.slice(offset, offset + 100)) refsById[row.id] = trackingId;
    }
    sent += items.length;
  }
  return { sent, refsById };
}
