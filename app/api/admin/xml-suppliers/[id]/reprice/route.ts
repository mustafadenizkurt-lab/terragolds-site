import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { repriceSupplierProducts, type Supplier } from "../../../../../../lib/xml-sync/syncSupplier";
import { getD1 } from "../../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Geçersiz tedarikçi id'si." }, { status: 400 });
    }
    const db = getD1();
    const supplier = await db
      .prepare(
        "SELECT id, name, feed_url AS feedUrl, field_mapping AS fieldMapping, default_markup_percent AS defaultMarkupPercent FROM xml_suppliers WHERE id = ?",
      )
      .bind(id)
      .first<Supplier>();
    if (!supplier) {
      return Response.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });
    }
    const result = await repriceSupplierProducts(db, supplier);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Fiyatlar güncellenemedi." },
      { status: 500 },
    );
  }
}
