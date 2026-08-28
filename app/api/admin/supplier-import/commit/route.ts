import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import { productNameToSlug } from "../../../../../lib/product-slugs";
import {
  applyMapping,
  MAX_BATCH_SIZE,
  parseSupplierXml,
  resolveSupplierXml,
  type FieldMapping,
} from "../../../../../lib/supplier-import";
import type { ImportFilters } from "../../../../../lib/xml-import-filters";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const form = await request.formData();
    const xmlText = await resolveSupplierXml(form);
    const records = parseSupplierXml(xmlText);

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
    const offset = Math.max(0, Math.trunc(Number(form.get("offset") ?? 0)) || 0);
    const limit = Math.min(
      MAX_BATCH_SIZE,
      Math.max(1, Math.trunc(Number(form.get("limit") ?? MAX_BATCH_SIZE)) || MAX_BATCH_SIZE),
    );

    const { rows, errors } = applyMapping(records, mapping, markupPercent, filters);
    const batch = rows.slice(offset, offset + limit);

    if (!batch.length) {
      return Response.json({
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
            (name, stone, category, price, stock, image, hover_image, badge,
             campaign_label, discount_percent, description,
             status, shopier_url, shopier_product_id, shopier_sync_status,
             featured, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           RETURNING id`,
        )
        .bind(
          product.name,
          product.stone,
          product.category,
          product.price,
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

    const existingSlugRows = await db
      .prepare("SELECT slug FROM products WHERE slug <> ''")
      .all<{ slug: string }>();
    const existingSlugs = new Set(existingSlugRows.results.map((row) => row.slug));
    const slugUpdates = insertResults.flatMap((result, index) => {
      const id = result.results[0]?.id;
      if (!id) return [];
      const slug = productNameToSlug(batch[index].product.name, id, existingSlugs);
      existingSlugs.add(slug);
      return [db.prepare("UPDATE products SET slug = ? WHERE id = ?").bind(slug, id)];
    });
    if (slugUpdates.length) await db.batch(slugUpdates);

    return Response.json({
      imported: batch.length,
      totalValid: rows.length,
      hasMore: offset + limit < rows.length,
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
