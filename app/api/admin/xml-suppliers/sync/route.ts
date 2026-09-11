import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { syncActiveSuppliers, syncSupplier, type Supplier } from "../../../../../lib/xml-sync/syncSupplier";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const db = getD1();
  const body = await request.json().catch(() => ({})) as { supplierId?: number };
  if (body.supplierId) {
    const supplier = await db.prepare("SELECT id, name, feed_url AS feedUrl, field_mapping AS fieldMapping, default_markup_percent AS defaultMarkupPercent FROM xml_suppliers WHERE id = ? LIMIT 1").bind(body.supplierId).first<Supplier>();
    if (!supplier) return Response.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });
    try {
      return Response.json({ results: [{ supplierId: supplier.id, result: await syncSupplier(db, supplier) }] });
    } catch (error) {
      // Same shape/status (200) as syncActiveSuppliers()'s own per-supplier
      // failures below, so the admin panel's existing result handling
      // doesn't need two different error shapes to deal with.
      return Response.json({
        results: [
          {
            supplierId: supplier.id,
            error: error instanceof Error ? error.message : "XML senkronu başarısız.",
          },
        ],
      });
    }
  }
  return Response.json({ results: await syncActiveSuppliers(db) });
}