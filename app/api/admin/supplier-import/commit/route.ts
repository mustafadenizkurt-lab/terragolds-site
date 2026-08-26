import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import {
  applyMapping,
  MAX_IMPORT_ROWS,
  parseSupplierXml,
  resolveSupplierXml,
  type FieldMapping,
} from "../../../../../lib/supplier-import";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const form = await request.formData();
    const xmlText = await resolveSupplierXml(form);
    let records = parseSupplierXml(xmlText);

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

    const markupPercent = Number(form.get("markupPercent") ?? 0) || 0;

    let truncated = false;
    if (records.length > MAX_IMPORT_ROWS) {
      records = records.slice(0, MAX_IMPORT_ROWS);
      truncated = true;
    }

    const { rows, errors } = applyMapping(records, mapping, markupPercent);

    if (!rows.length) {
      return Response.json({ imported: 0, skipped: errors.length, errors, truncated });
    }

    const db = getD1();
    const statements = rows.map(({ product }) =>
      db
        .prepare(
          `INSERT INTO products
            (name, stone, category, price, stock, image, hover_image, badge,
             campaign_label, discount_percent, description,
             status, shopier_url, shopier_product_id, shopier_sync_status,
             featured, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
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
    await db.batch(statements);

    return Response.json({
      imported: rows.length,
      skipped: errors.length,
      errors,
      truncated,
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
