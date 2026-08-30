import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1, getMediaBucket } from "../../../../../lib/store-db";
import { productNameToSlug } from "../../../../../lib/product-slugs";
import {
  applyMapping,
  FEED_CACHE_PREFIX,
  MAX_BATCH_SIZE,
  parseSupplierXml,
  resolveSupplierXml,
  type FieldMapping,
  type FlatRecord,
  type ImportRow,
  type ImportRowError,
} from "../../../../../lib/supplier-import";
import type { ImportFilters } from "../../../../../lib/xml-import-filters";

export const dynamic = "force-dynamic";

const CACHE_PREFIX = "supplier-import-cache/";

type ImportCache = {
  rows: ImportRow[];
  errors: ImportRowError[];
  existingSlugs: string[];
};

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const form = await request.formData();
    const offset = Math.max(0, Math.trunc(Number(form.get("offset") ?? 0)) || 0);
    const limit = Math.min(
      MAX_BATCH_SIZE,
      Math.max(1, Math.trunc(Number(form.get("limit") ?? MAX_BATCH_SIZE)) || MAX_BATCH_SIZE),
    );
    const requestedImportId = String(form.get("importId") ?? "");

    let importId = requestedImportId;
    let cache: ImportCache;

    if (importId) {
      // A later batch of an import already in progress: reuse the feed this
      // import already parsed and validated on its first batch, instead of
      // re-uploading the whole XML file and re-parsing it from scratch on
      // every single batch request (that repeat parsing, once per ~500-row
      // batch, is what was exceeding the Worker's CPU limit on large feeds).
      const cached = await getMediaBucket().get(`${CACHE_PREFIX}${importId}.json`);
      if (!cached) {
        return Response.json(
          { error: "İçe aktarma oturumu bulunamadı, lütfen tekrar deneyin." },
          { status: 400 },
        );
      }
      cache = JSON.parse(await cached.text()) as ImportCache;
    } else {
      const feedImportId = String(form.get("feedImportId") ?? "");
      let records: FlatRecord[];
      if (feedImportId) {
        // The admin already previewed this feed, which parsed and cached it
        // under this id - reuse that instead of re-fetching the URL/file and
        // re-parsing the XML a second time right before the actual import.
        const cachedFeed = await getMediaBucket().get(`${FEED_CACHE_PREFIX}${feedImportId}.json`);
        if (!cachedFeed) {
          return Response.json(
            { error: "Önizleme oturumu bulunamadı, lütfen XML'i tekrar getirin." },
            { status: 400 },
          );
        }
        records = JSON.parse(await cachedFeed.text()) as FlatRecord[];
      } else {
        const xmlText = await resolveSupplierXml(form);
        records = parseSupplierXml(xmlText);
      }

      const mappingRaw = String(form.get("mapping") ?? "");
      let mapping: FieldMapping;
      try {
        mapping = JSON.parse(mappingRaw) as FieldMapping;
      } catch {
        return Response.json(
          { error: "Eşleştirme verisi okunamadı." },
          { status: 400 },
        );
      }

      const filtersRaw = String(form.get("filters") ?? "");
      let filters: ImportFilters = {};
      if (filtersRaw) {
        try {
          filters = JSON.parse(filtersRaw) as ImportFilters;
        } catch {
          return Response.json({ error: "Filtre verisi okunamadı." }, { status: 400 });
        }
      }

      const markupPercent = Number(form.get("markupPercent") ?? 0) || 0;
      const { rows, errors } = applyMapping(records, mapping, markupPercent, filters);
      const existingSlugRows = await getD1()
        .prepare("SELECT slug FROM products WHERE slug <> ''")
        .all<{ slug: string }>();

      importId = crypto.randomUUID();
      cache = {
        rows,
        errors,
        existingSlugs: existingSlugRows.results.map((row) => row.slug),
      };
    }

    const { rows, errors } = cache;
    const batch = rows.slice(offset, offset + limit);
    const cacheKey = `${CACHE_PREFIX}${importId}.json`;

    if (!batch.length) {
      await getMediaBucket().delete(cacheKey).catch(() => {});
      return Response.json({
        importId,
        imported: 0,
        totalValid: rows.length,
        hasMore: false,
        errorCount: errors.length,
        errors: offset === 0 ? errors.slice(0, 200) : [],
      });
    }

    const db = getD1();
    const statements = batch.map(({ product }) =>
      db
        .prepare(
          `INSERT INTO products
            (name, stone, category, price, cost, stock, image, hover_image, badge,
             campaign_label, discount_percent, description,
             status, shopier_url, shopier_product_id, shopier_sync_status,
             featured, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           RETURNING id`,
        )
        .bind(
          product.name,
          product.stone,
          product.category,
          product.price,
          product.cost,
          product.stock,
          product.image,
          product.hoverImage ?? null,
          product.badge ?? null,
          product.campaignLabel ?? null,
          product.discountPercent,
          product.description,
          product.status,
          product.shopierUrl ?? null,
          product.shopierProductId ?? null,
          product.shopierSyncStatus,
          product.featured ? 1 : 0,
          product.sortOrder,
        ),
    );
    const insertResults = await db.batch<{ id: number }>(statements);

    const existingSlugSet = new Set(cache.existingSlugs);
    const slugUpdates = insertResults.flatMap((result, index) => {
      const id = result.results[0]?.id;
      if (!id) return [];
      const slug = productNameToSlug(batch[index].product.name, id, existingSlugSet);
      existingSlugSet.add(slug);
      return [db.prepare("UPDATE products SET slug = ? WHERE id = ?").bind(slug, id)];
    });
    if (slugUpdates.length) await db.batch(slugUpdates);

    const hasMore = offset + limit < rows.length;
    if (hasMore) {
      // Persist the slugs this batch just claimed so the next batch of this
      // same import doesn't hand out a duplicate.
      cache.existingSlugs = [...existingSlugSet];
      await getMediaBucket().put(cacheKey, JSON.stringify(cache));
    } else {
      await getMediaBucket().delete(cacheKey).catch(() => {});
    }

    return Response.json({
      importId,
      imported: batch.length,
      totalValid: rows.length,
      hasMore,
      errorCount: errors.length,
      errors: offset === 0 ? errors.slice(0, 200) : [],
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "İçe aktarma başarısız oldu.",
      },
      { status: 400 },
    );
  }
}
