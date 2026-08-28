import { calculatePrice } from "./calculatePrice";
import { fetchFeed } from "./fetchFeed";
import { parseFeed, readMappedValue, type XmlRecord } from "./parseFeed";
import { matchesFilters, type ImportFilters } from "../xml-import-filters";

export type SupplierMapping = {
  externalId?: string;
  name?: string;
  stone?: string;
  category?: string;
  brand?: string;
  price?: string;
  stock?: string;
  image?: string;
  description?: string;
};

type Supplier = {
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
    for (const record of records) {
      const product = mapRecord(record, mapping, supplier.defaultMarkupPercent);
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
        "SELECT id FROM products WHERE xml_supplier_id = ? AND xml_external_id = ? LIMIT 1",
      ).bind(supplier.id, product.externalId).first<{ id: number }>();
      if (existing) {
        await db.prepare(
          `UPDATE products SET name = ?, stone = ?, category = ?, price = ?, stock = ?, image = ?, description = ?, xml_sync_status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).bind(product.name, product.stone, product.category, product.price, product.stock, product.image, product.description, existing.id).run();
        updated += 1;
      } else {
        await db.prepare(
          `INSERT INTO products (name, stone, category, price, stock, image, description, status, xml_supplier_id, xml_external_id, xml_sync_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 'synced', CURRENT_TIMESTAMP)`,
        ).bind(product.name, product.stone, product.category, product.price, product.stock, product.image, product.description, supplier.id, product.externalId).run();
        imported += 1;
      }
    }
    const completedAt = new Date().toISOString();
    await db.prepare(
      "UPDATE xml_sync_logs SET status = 'success', completed_at = ?, imported_count = ?, updated_count = ?, skipped_count = ? WHERE id = ?",
    ).bind(completedAt, imported, updated, skipped, log?.id ?? 0).run();
    await db.prepare("UPDATE xml_suppliers SET last_synced_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(completedAt, supplier.id).run();
    return { imported, updated, skipped, logId: log?.id };
  } catch (error) {
    await db.prepare(
      "UPDATE xml_sync_logs SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?",
    ).bind(new Date().toISOString(), error instanceof Error ? error.message : "XML senkronu başarısız.", log?.id ?? 0).run();
    throw error;
  }
}

function mapRecord(record: XmlRecord, mapping: SupplierMapping, markup: number) {
  const cost = Number(readMappedValue(record, mapping.price).replace(",", "."));
  return {
    externalId: readMappedValue(record, mapping.externalId),
    name: readMappedValue(record, mapping.name),
    stone: readMappedValue(record, mapping.stone),
    category: readMappedValue(record, mapping.category) || "Doğal Taşlar",
    brand: readMappedValue(record, mapping.brand),
    price: Number.isFinite(cost) ? calculatePrice(cost, markup) : null,
    stock: Math.max(0, Number.parseInt(readMappedValue(record, mapping.stock) || "0", 10) || 0),
    image: readMappedValue(record, mapping.image),
    description: readMappedValue(record, mapping.description),
  };
}
