import { calculatePrice } from "./calculatePrice";
import { fetchFeed } from "./fetchFeed";
import { parseFeed, readMappedValue, type XmlRecord } from "./parseFeed";
import { matchesFilters, type ImportFilters } from "../xml-import-filters";
import { resolveProductSlug } from "../product-slugs";
import { rewriteProductDescription } from "../product-description-rewrite";
import { getOptionalEnv } from "../runtime-env";
import { pushInventoryToShopify } from "../shopify/inventory";
import { pushPriceToShopify } from "../shopify/price";

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

export async function syncSupplier(db: D1Database, supplier: Supplier): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const log = await db.prepare(
    "INSERT INTO xml_sync_logs (supplier_id, status, started_at) VALUES (?, 'running', ? ) RETURNING id",
  ).bind(supplier.id, startedAt).first<{ id: number }>();
  try {
    const mapping = JSON.parse(supplier.fieldMapping || "{}") as SupplierMapping;
    const filters = JSON.parse(supplier.filters || "{}") as ImportFilters;
    const records = parseFeed(await fetchFeed(supplier.feedUrl));
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
      if (matchedId) {
        await db.prepare(
          `UPDATE products SET name = ?, stone = ?, category = ?, price = ?, cost = ?, stock = ?, image = ?, description = ?, xml_sync_status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).bind(product.name, product.stone, product.category, product.price, product.cost, product.stock, product.image, product.description, matchedId).run();
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
          `INSERT INTO products (name, stone, category, price, cost, stock, image, description, status, xml_supplier_id, xml_external_id, xml_sync_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 'synced', CURRENT_TIMESTAMP) RETURNING id`,
        ).bind(product.name, product.stone, product.category, product.price, product.cost, product.stock, product.image, description, supplier.id, product.externalId).first<{ id: number }>();
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
  let updated = 0;
  let skipped = 0;
  for (const record of records) {
    const product = mapRecord(record, mapping, supplier.defaultMarkupPercent);
    if (!product.externalId || product.price === null) {
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
