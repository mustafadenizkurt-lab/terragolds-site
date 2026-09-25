import { calculatePrice } from "./calculatePrice";
import { fetchFeed } from "./fetchFeed";
import { parseFeed, readMappedValue, type XmlRecord } from "./parseFeed";
import { matchesFilters, type ImportFilters } from "../xml-import-filters";
import { resolveProductSlug } from "../product-slugs";
import { rewriteProductDescription } from "../product-description-rewrite";
import { getOptionalEnv } from "../runtime-env";
import { pushInventoryToShopify } from "../shopify/inventory";
import { pushPriceToShopify } from "../shopify/price";
import { pushStockAndPriceToTrendyol, categoryIdFor } from "../trendyol/sync";
import { ensureTrendyolColumns } from "../trendyol/client";
import { calculateTrendyolLimitsFromCost } from "../trendyol/pricing-formula";
import { pushStockAndPriceToHepsiburada } from "../hepsiburada/sync";
import { loadExcludedExternalIds } from "./excluded-products";
import { ensureImageLockColumn } from "../product-image-lock";

export type SupplierMapping = {
  externalId?: string;
  name?: string;
  stone?: string;
  category?: string;
  brand?: string;
  price?: string;
  /**
   * Optional path to a supplier-suggested consumer/retail price (e.g. a
   * feed's "son_kullanici" field). When mapped and present, this is used
   * directly as the sell price instead of `price` (wholesale cost) run
   * through calculatePrice() - the supplier's own recommendation, not our
   * markup formula. `price` is still read and stored as `cost` either way.
   */
  retailPrice?: string;
  stock?: string;
  image?: string;
  // Sitede/Trendyol'da "hover" görüntülendiğinde görünen ikinci fotoğraf
  // (ör. bir tedarikçi feed'inde "resim.resim2") - opsiyonel, her tedarikçi
  // ikinci bir fotoğraf sağlamıyor.
  hoverImage?: string;
  description?: string;
};

export type Supplier = {
  id: number;
  name: string;
  feedUrl: string;
  fieldMapping: string;
  filters: string;
  defaultMarkupPercent: number;
};

export type SyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  discontinued: number;
  logId?: number;
};

export async function syncActiveSuppliers(db: D1Database) {
  const suppliers = await db.prepare(
    "SELECT id, name, feed_url AS feedUrl, field_mapping AS fieldMapping, filters, default_markup_percent AS defaultMarkupPercent FROM xml_suppliers WHERE active = 1 ORDER BY id",
  ).all<Supplier>();
  const results = [];
  for (const supplier of suppliers.results) {
    try {
      results.push({ supplierId: supplier.id, result: await syncSupplier(db, supplier) });
    } catch (error) {
      results.push({ supplierId: supplier.id, error: error instanceof Error ? error.message : "XML senkronu başarısız." });
    }
  }
  return results;
}

// syncActiveSuppliers() ile aynı desen ama restockSupplierProducts()
// çağırıyor - 'manual' ürünlerin stoğu normal senkrona dahil olmadığı için
// (bkz. restockSupplierProducts yorumu) ayrı bir cron adımı gerekiyor.
export async function restockActiveSuppliers(db: D1Database) {
  const suppliers = await db.prepare(
    "SELECT id, name, feed_url AS feedUrl, field_mapping AS fieldMapping, filters, default_markup_percent AS defaultMarkupPercent FROM xml_suppliers WHERE active = 1 ORDER BY id",
  ).all<Supplier>();
  const results = [];
  for (const supplier of suppliers.results) {
    try {
      results.push({ supplierId: supplier.id, result: await restockSupplierProducts(db, supplier) });
    } catch (error) {
      results.push({ supplierId: supplier.id, error: error instanceof Error ? error.message : "Stok senkronu başarısız." });
    }
  }
  return results;
}

// A 'running' row older than this was almost certainly orphaned, not a
// sync that's genuinely still in progress - every observed real run
// (success or failure) completes within a couple of minutes. The manual
// "Senkronla" route awaits syncSupplier() directly (no ctx.waitUntil), so
// if the admin's browser disconnects mid-request Cloudflare can kill the
// invocation before its own catch/finally ever runs, leaving the row
// stuck at 'running' forever. The cron path doesn't have this problem
// (it's wrapped in ctx.waitUntil), which is why every stuck row observed
// so far came from a manual trigger.
const STALE_RUNNING_MINUTES = 10;

async function reclaimStaleRunningLogs(db: D1Database, supplierId: number): Promise<void> {
  await db
    .prepare(
      `UPDATE xml_sync_logs
       SET status = 'failed', completed_at = ?,
           error_message = 'Önceki çalıştırma yarıda kesildi (yanıt tamamlanmadan bağlantı koptu) - otomatik olarak temizlendi.'
       WHERE supplier_id = ? AND status = 'running'
         AND started_at <= datetime('now', '-' || ? || ' minutes')`,
    )
    .bind(new Date().toISOString(), supplierId, STALE_RUNNING_MINUTES)
    .run();
}

async function hasActiveRunningLog(db: D1Database, supplierId: number): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM xml_sync_logs WHERE supplier_id = ? AND status = 'running' LIMIT 1")
    .bind(supplierId)
    .first<{ id: number }>();
  return Boolean(row);
}

export async function syncSupplier(db: D1Database, supplier: Supplier): Promise<SyncResult> {
  await ensureImageLockColumn(db);
  await ensureTrendyolColumns(db);
  // Clean up any orphaned row from a previous invocation first, then check
  // whether a genuinely still-running sync remains - only refuses to start
  // when one does, so this never blocks a normal run.
  await reclaimStaleRunningLogs(db, supplier.id);
  if (await hasActiveRunningLog(db, supplier.id)) {
    throw new Error(
      "Bu tedarikçi için başka bir senkron hâlâ çalışıyor, lütfen bitmesini bekleyin.",
    );
  }

  const startedAt = new Date().toISOString();
  const log = await db.prepare(
    "INSERT INTO xml_sync_logs (supplier_id, status, started_at) VALUES (?, 'running', ? ) RETURNING id",
  ).bind(supplier.id, startedAt).first<{ id: number }>();
  try {
    const mapping = JSON.parse(supplier.fieldMapping || "{}") as SupplierMapping;
    const filters = JSON.parse(supplier.filters || "{}") as ImportFilters;
    const records = parseFeed(await fetchFeed(supplier.feedUrl));
    const excludedExternalIds = await loadExcludedExternalIds(db, supplier.id);
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    // Every external id seen in this feed run, regardless of whether the
    // record ends up skipped for missing data or filtered out below - both
    // of those still mean the supplier is still offering the item, just not
    // in a state we import/update it in right now. Only an id absent from
    // the feed entirely means the supplier has actually discontinued it.
    const seenExternalIds = new Set<string>();
    for (const record of records) {
      const product = mapRecord(record, mapping, supplier.defaultMarkupPercent);
      if (product.externalId) seenExternalIds.add(product.externalId);
      if (!product.externalId || !product.name || product.price === null) {
        skipped += 1;
        continue;
      }
      if (
        !matchesFilters(
          { category: product.category, brand: product.brand, price: product.price, stock: product.stock },
          filters,
        )
      ) {
        skipped += 1;
        continue;
      }
      // Admin panelinden silinmiş (ve bu yüzden hariç tutulan) bir ürünün
      // kodu - feed'de hâlâ görünse bile sıfırdan yeniden oluşturulmuyor.
      // bkz. lib/xml-sync/excluded-products.ts.
      if (excludedExternalIds.has(product.externalId)) {
        skipped += 1;
        continue;
      }
      const existing = await db.prepare(
        "SELECT id, xml_sync_status AS xmlSyncStatus, stock AS stock, price AS price FROM products WHERE xml_supplier_id = ? AND xml_external_id = ? LIMIT 1",
      ).bind(supplier.id, product.externalId).first<{ id: number; xmlSyncStatus: string; stock: number; price: number }>();
      // Match only on an exact (supplier, external id) link, never by name:
      // products without that link may be sourced independently of this
      // feed (e.g. added by hand from a different supplier) and coincidentally
      // share a name with a feed row, so name alone is never safe grounds to
      // attach them to this supplier and start overwriting their price/stock.
      //
      // A matched row is only updated when it was itself created by a
      // previous run of this same sync (xml_sync_status = 'synced'). Many
      // existing rows share this supplier's own external-id scheme (their
      // stok_kodu) from an earlier one-off bulk import that set
      // xml_sync_status = 'manual' - those are managed by hand (pricing
      // included) and must never be silently overwritten by this feed.
      if (existing && existing.xmlSyncStatus !== "synced") {
        skipped += 1;
        continue;
      }
      const matchedId = existing?.id;
      // Trendyol dinamik fiyatlama botunun bu ürün için uyacağı taban/tavan -
      // sadece cost biliniyorsa hesaplanır (bkz. calculateTrendyolLimitsFromCost
      // yorumu, cost=0 "bilinmiyor" demek, ondan bir sınır türetmek yanıltıcı
      // olurdu). null ise aşağıdaki CASE/INSERT bu alanları hiç değiştirmez.
      const autoLimits = product.cost > 0
        ? calculateTrendyolLimitsFromCost(product.cost, categoryIdFor(product))
        : null;
      if (matchedId) {
        // image_locked_at doluysa (admin bu ürünün görselini kendi panelimizden
        // elle düzeltmişse - bkz. lib/product-image-lock.ts) tedarikçinin
        // orijinal görseli buraya hiç yazılmıyor, mevcut (düzeltilmiş) görsel
        // korunuyor. hover_image gibi diğer alanlar normal güncelleniyor.
        // trendyol_lower/upper_limit_price aynı mantıkla korunuyor: sadece
        // hâlâ NULL'sa (hiç admin/otomatik değer atanmamışsa) dolduruluyor -
        // admin panelden (/api/admin/products/trendyol-limits) elle girilmiş
        // bir sınırın üzerine XML senkronu bir daha asla yazmıyor.
        await db.prepare(
          `UPDATE products SET name = ?, stone = ?, category = ?, price = ?, cost = ?, stock = ?,
             image = CASE WHEN image_locked_at IS NULL THEN ? ELSE image END,
             hover_image = COALESCE(?, hover_image), description = ?, xml_sync_status = 'synced',
             trendyol_lower_limit_price = CASE WHEN trendyol_lower_limit_price IS NULL THEN ? ELSE trendyol_lower_limit_price END,
             trendyol_upper_limit_price = CASE WHEN trendyol_upper_limit_price IS NULL THEN ? ELSE trendyol_upper_limit_price END,
             updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).bind(
          product.name, product.stone, product.category, product.price, product.cost, product.stock,
          product.image, product.hoverImage, product.description,
          autoLimits?.lowerLimit ?? null, autoLimits?.upperLimit ?? null,
          matchedId,
        ).run();
        updated += 1;
        // D1 is the source of truth for stock - push this product's new
        // count to Shopify (a no-op if it isn't synced there yet). Only
        // when stock actually changed: this call costs at least one
        // Shopify API round-trip, and a feed update that only touches
        // price (e.g. a markup/mapping change across a whole supplier)
        // would otherwise fire it for every single matched product -
        // thousands of sequential Shopify calls in one sync run, enough
        // to blow past the request's execution time/subrequest limit and
        // leave the run stuck instead of completing or failing cleanly.
        if (existing.stock !== product.stock) {
          try {
            await pushInventoryToShopify(db, matchedId);
          } catch {
            // Self-heals on the next stock change or scheduled sync.
          }
        }
        // Same reasoning as the stock push above, guarded the same way:
        // only fire this per-product Shopify call when the price actually
        // changed for THIS product, never unconditionally for every matched
        // row in the run.
        if (existing.price !== product.price) {
          try {
            await pushPriceToShopify(db, matchedId);
          } catch {
            // Self-heals on the next price change, scheduled sync, or a
            // manual "fiyatları güncelle" backfill run.
          }
        }
      } else {
        const description = await uniqueDescriptionForNewProduct(product);
        const created = await db.prepare(
          `INSERT INTO products (name, stone, category, price, cost, stock, image, hover_image, description, status, xml_supplier_id, xml_external_id, xml_sync_status, trendyol_lower_limit_price, trendyol_upper_limit_price, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 'synced', ?, ?, CURRENT_TIMESTAMP) RETURNING id`,
        ).bind(
          product.name, product.stone, product.category, product.price, product.cost, product.stock,
          product.image, product.hoverImage, description, supplier.id, product.externalId,
          autoLimits?.lowerLimit ?? null, autoLimits?.upperLimit ?? null,
        ).first<{ id: number }>();
        if (created?.id) {
          const slug = await resolveProductSlug(db, product.name, created.id);
          await db.prepare("UPDATE products SET slug = ? WHERE id = ?").bind(slug, created.id).run();
        }
        imported += 1;
      }
    }
    const discontinued = await markDiscontinuedProducts(db, supplier.id, seenExternalIds);

    const completedAt = new Date().toISOString();
    await db.prepare(
      "UPDATE xml_sync_logs SET status = 'success', completed_at = ?, imported_count = ?, updated_count = ?, skipped_count = ?, details = ? WHERE id = ?",
    ).bind(completedAt, imported, updated, skipped, JSON.stringify({ discontinued }), log?.id ?? 0).run();
    await db.prepare("UPDATE xml_suppliers SET last_synced_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(completedAt, supplier.id).run();
    return { imported, updated, skipped, discontinued, logId: log?.id };
  } catch (error) {
    await db.prepare(
      "UPDATE xml_sync_logs SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?",
    ).bind(new Date().toISOString(), error instanceof Error ? error.message : "XML senkronu başarısız.", log?.id ?? 0).run();
    throw error;
  }
}

// Products this supplier previously synced in but that no longer appear
// anywhere in its feed are out of stock at the source - set their stock to
// 0 so they stop being sellable here too. Only 'synced' rows are touched
// (never 'manual', for the same hand-managed-products reason as the main
// loop above), and only ones the feed run hasn't already zeroed via a
// normal price/stock update. Done as a small per-row loop rather than one
// giant SQL NOT IN (...) because a supplier feed can have thousands of
// external ids, which would blow past D1's per-statement parameter limit.
async function markDiscontinuedProducts(
  db: D1Database,
  supplierId: number,
  seenExternalIds: Set<string>,
): Promise<number> {
  const rows = await db
    .prepare(
      "SELECT id, xml_external_id AS xmlExternalId FROM products WHERE xml_supplier_id = ? AND xml_sync_status = 'synced' AND xml_external_id IS NOT NULL AND stock > 0",
    )
    .bind(supplierId)
    .all<{ id: number; xmlExternalId: string }>();
  let discontinued = 0;
  for (const row of rows.results) {
    if (seenExternalIds.has(row.xmlExternalId)) continue;
    await db
      .prepare("UPDATE products SET stock = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(row.id)
      .run();
    discontinued += 1;
  }
  return discontinued;
}

async function uniqueDescriptionForNewProduct(product: {
  name: string;
  stone: string;
  category: string;
  description: string;
}): Promise<string> {
  const apiKey = getOptionalEnv("ANTHROPIC_API_KEY");
  if (!apiKey || !product.description) return product.description;
  try {
    return await rewriteProductDescription(apiKey, product);
  } catch {
    // AI yeniden yazımı başarısız olursa senkronu bloklamadan ham açıklamayla devam et.
    return product.description;
  }
}

export function mapRecord(record: XmlRecord, mapping: SupplierMapping, markup: number) {
  const rawPrice = readMappedValue(record, mapping.price);
  const cost = rawPrice ? Number(rawPrice.replace(",", ".")) : NaN;
  const hasCost = Number.isFinite(cost) && cost > 0;

  const rawRetailPrice = readMappedValue(record, mapping.retailPrice);
  const retailPrice = rawRetailPrice ? Number(rawRetailPrice.replace(",", ".")) : NaN;
  const hasRetailPrice = Number.isFinite(retailPrice) && retailPrice > 0;

  return {
    externalId: readMappedValue(record, mapping.externalId),
    name: readMappedValue(record, mapping.name),
    stone: readMappedValue(record, mapping.stone),
    category: readMappedValue(record, mapping.category) || "Takı",
    brand: readMappedValue(record, mapping.brand),
    // cost must be a positive finite number: an empty/unmapped price string
    // coerces to 0 via Number(""), which would otherwise pass Number.isFinite
    // and silently zero out the product's price.
    price: hasRetailPrice
      ? Math.max(0, Math.round(retailPrice))
      : hasCost
        ? calculatePrice(cost, markup)
        : null,
    cost: hasCost ? Math.max(0, Math.round(cost)) : 0,
    stock: Math.max(0, Number.parseInt(readMappedValue(record, mapping.stock) || "0", 10) || 0),
    image: readMappedValue(record, mapping.image),
    hoverImage: readMappedValue(record, mapping.hoverImage) || null,
    description: readMappedValue(record, mapping.description),
  };
}

export type RepriceResult = { updated: number; skipped: number; total: number };

// Re-prices every product linked to this supplier by xml_external_id,
// regardless of xml_sync_status - unlike syncSupplier(), which only ever
// touches xml_sync_status = 'synced' rows to protect hand-managed
// ('manual') ones from having their name/description/image/stock silently
// overwritten. This only ever writes price and cost, so a "manual" row's
// other hand-edited fields are left untouched even as its price catches up
// to a field-mapping change (e.g. adding retailPrice).
export async function repriceSupplierProducts(
  db: D1Database,
  supplier: Supplier,
): Promise<RepriceResult> {
  const mapping = JSON.parse(supplier.fieldMapping || "{}") as SupplierMapping;
  const records = parseFeed(await fetchFeed(supplier.feedUrl));
  const excludedExternalIds = await loadExcludedExternalIds(db, supplier.id);
  let updated = 0;
  let skipped = 0;
  for (const record of records) {
    const product = mapRecord(record, mapping, supplier.defaultMarkupPercent);
    if (!product.externalId || product.price === null) {
      skipped += 1;
      continue;
    }
    // bkz. syncSupplier()'daki aynı kontrol - lib/xml-sync/excluded-products.ts
    if (excludedExternalIds.has(product.externalId)) {
      skipped += 1;
      continue;
    }
    const result = await db
      .prepare(
        `UPDATE products SET price = ?, cost = ?, updated_at = CURRENT_TIMESTAMP WHERE xml_supplier_id = ? AND xml_external_id = ?`,
      )
      .bind(product.price, product.cost, supplier.id, product.externalId)
      .run();
    if (result.meta.changes > 0) {
      updated += 1;
    } else {
      skipped += 1;
    }
  }
  return { updated, skipped, total: records.length };
}

export type RestockResult = {
  updated: number;
  discontinued: number;
  skipped: number;
  total: number;
};

type StockRow = { id: number; xmlExternalId: string; stock: number };

const RESTOCK_WRITE_BATCH_SIZE = 500; // db.batch() tek çağrıda çok fazla statement almasın diye

// syncSupplier()'ın stok/discontinued mantığıyla aynı fikir ama sadece
// 'synced' değil, xml_supplier_id+xml_external_id ile eşleşen TÜM ürünleri
// (repriceSupplierProducts'taki gibi 'manual' dahil) kapsıyor - 'manual'
// işaretli ürünlerin stoğu bu feed'e hiç bağlı olmadığından, tedarikçide
// tükenen bir ürün D1'de sonsuza kadar "stokta" görünmeye devam ediyordu
// (gerçek bir sipariş yanlışlıkla kabul edilmiş, kullanıcı fark etti).
// Fiyat/isim/kategori/açıklama gibi elle yönetilen hiçbir alana dokunmuyor -
// SADECE stock yazıyor, tıpkı repriceSupplierProducts'ın sadece price/cost
// yazması gibi.
//
// Feed kaydı başına ayrı bir D1 SELECT atan ilk sürüm (binlerce sıralı
// round-trip) isteği zaman aşımına uğrattı - bulk-price-increase'de
// yaşanan aynı sorun. Bunun yerine bu tedarikçinin TÜM ürünleri TEK
// sorguyla belleğe alınıp karşılaştırma bellekte yapılıyor, sadece
// GERÇEKTEN değişen satırlar db.batch() ile toplu yazılıyor.
export async function restockSupplierProducts(
  db: D1Database,
  supplier: Supplier,
): Promise<RestockResult> {
  const mapping = JSON.parse(supplier.fieldMapping || "{}") as SupplierMapping;
  const records = parseFeed(await fetchFeed(supplier.feedUrl));
  const excludedExternalIds = await loadExcludedExternalIds(db, supplier.id);

  const existingRows = await db
    .prepare(
      "SELECT id, xml_external_id AS xmlExternalId, stock FROM products WHERE xml_supplier_id = ? AND xml_external_id IS NOT NULL",
    )
    .bind(supplier.id)
    .all<StockRow>();
  const byExternalId = new Map(existingRows.results.map((row) => [row.xmlExternalId, row]));

  let skipped = 0;
  const seenExternalIds = new Set<string>();
  const changed: { id: number; newStock: number; discontinued: boolean }[] = [];

  for (const record of records) {
    const product = mapRecord(record, mapping, supplier.defaultMarkupPercent);
    if (!product.externalId) {
      skipped += 1;
      continue;
    }
    seenExternalIds.add(product.externalId);

    // bkz. syncSupplier()'daki aynı kontrol - lib/xml-sync/excluded-products.ts
    if (excludedExternalIds.has(product.externalId)) {
      skipped += 1;
      continue;
    }

    const existing = byExternalId.get(product.externalId);
    if (!existing || existing.stock === product.stock) {
      skipped += 1;
      continue;
    }
    changed.push({ id: existing.id, newStock: product.stock, discontinued: false });
  }

  // markDiscontinuedProducts'ın (syncSupplier'ın kendi 'synced'-only
  // sürümü) aynı fikri ama xml_sync_status filtresi YOK - 'manual' ürünler
  // de feed'den tamamen düşmüşse (tedarikçi artık hiç satmıyor) stoğu 0'a
  // çekiliyor. Aynı bellekteki liste üzerinden, ekstra sorgu gerekmeden.
  for (const row of existingRows.results) {
    if (row.stock > 0 && !seenExternalIds.has(row.xmlExternalId)) {
      changed.push({ id: row.id, newStock: 0, discontinued: true });
    }
  }

  for (let offset = 0; offset < changed.length; offset += RESTOCK_WRITE_BATCH_SIZE) {
    const chunk = changed.slice(offset, offset + RESTOCK_WRITE_BATCH_SIZE);
    const updateStmt = db.prepare(
      "UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    );
    await db.batch(chunk.map(({ id, newStock }) => updateStmt.bind(newStock, id)));
  }

  // Pazaryeri push'ları (ağ çağrıları) D1 yazımından ayrı, sıralı kalıyor -
  // bunlar zaten kendi rate limitleriyle sınırlı ve genelde çok daha az
  // sayıda (sadece gerçekten değişenler), D1 SELECT'leri gibi binlerce değil.
  for (const { id } of changed) {
    await pushStockEverywhere(db, id);
  }

  const discontinued = changed.filter((entry) => entry.discontinued).length;
  return {
    updated: changed.length - discontinued,
    discontinued,
    skipped,
    total: records.length,
  };
}

// D1'deki yeni stok, ürünün listelendiği her pazaryerine tek tek gönderilir
// (hiçbiri diğerinin varlığını varsaymadan - push* fonksiyonlarının her biri
// zaten "bu kanala hiç gönderilmemişse no-op" davranışında).
//
// Shopify kanalı pasife alındı (hiç sipariş gelmiyordu) - bkz.
// worker/index.ts scheduled(). O push kasıtlı olarak burada da atlanıyor.
async function pushStockEverywhere(db: D1Database, productId: number): Promise<void> {
  try {
    await pushStockAndPriceToTrendyol(db, productId);
  } catch {
    // Self-heals on the next stock change or a manual price/stock backfill.
  }
  try {
    await pushStockAndPriceToHepsiburada(db, productId);
  } catch {
    // Self-heals on the next stock change or a manual price/stock backfill.
  }
}

export type HoverImageBackfillResult = {
  updated: number;
  skipped: number;
  total: number;
};

// restockSupplierProducts ile aynı desen (tek sorguda tüm ürünler belleğe
// alınıp bellekte karşılaştırılıyor, sadece değişenler db.batch() ile
// yazılıyor) - ama stock yerine hover_image. xml_sync_status'tan bağımsız
// TÜM eşleşen ürünleri kapsıyor (repriceSupplierProducts'taki gibi 'manual'
// dahil) - hover_image hiçbir zaman elle yönetilen bir alan olmadı, bu
// yüzden geriye dönük doldurmak güvenli.
export async function backfillHoverImages(
  db: D1Database,
  supplier: Supplier,
): Promise<HoverImageBackfillResult> {
  const mapping = JSON.parse(supplier.fieldMapping || "{}") as SupplierMapping;
  const records = parseFeed(await fetchFeed(supplier.feedUrl));
  const excludedExternalIds = await loadExcludedExternalIds(db, supplier.id);

  const existingRows = await db
    .prepare(
      "SELECT id, xml_external_id AS xmlExternalId, hover_image AS hoverImage FROM products WHERE xml_supplier_id = ? AND xml_external_id IS NOT NULL",
    )
    .bind(supplier.id)
    .all<{ id: number; xmlExternalId: string; hoverImage: string | null }>();
  const byExternalId = new Map(existingRows.results.map((row) => [row.xmlExternalId, row]));

  let skipped = 0;
  const changed: { id: number; hoverImage: string }[] = [];
  for (const record of records) {
    const product = mapRecord(record, mapping, supplier.defaultMarkupPercent);
    if (!product.externalId || !product.hoverImage) {
      skipped += 1;
      continue;
    }
    // bkz. syncSupplier()'daki aynı kontrol - lib/xml-sync/excluded-products.ts
    if (excludedExternalIds.has(product.externalId)) {
      skipped += 1;
      continue;
    }
    const existing = byExternalId.get(product.externalId);
    if (!existing || existing.hoverImage === product.hoverImage) {
      skipped += 1;
      continue;
    }
    changed.push({ id: existing.id, hoverImage: product.hoverImage });
  }

  for (let offset = 0; offset < changed.length; offset += RESTOCK_WRITE_BATCH_SIZE) {
    const chunk = changed.slice(offset, offset + RESTOCK_WRITE_BATCH_SIZE);
    const updateStmt = db.prepare(
      "UPDATE products SET hover_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    );
    await db.batch(chunk.map(({ id, hoverImage }) => updateStmt.bind(hoverImage, id)));
  }

  return { updated: changed.length, skipped, total: records.length };
}
