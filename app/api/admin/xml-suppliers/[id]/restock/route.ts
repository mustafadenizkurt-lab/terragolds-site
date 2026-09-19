import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { restockSupplierProducts, type Supplier } from "../../../../../../lib/xml-sync/syncSupplier";
import { getD1 } from "../../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// reprice/route.ts ile aynı desen, ama fiyat yerine SADECE stok günceller -
// xml_sync_status = 'manual' ürünler dahil (bkz. restockSupplierProducts
// yorumu: bu ürünlerin stoğu normal senkrona hiç bağlı değil, tedarikçide
// tükenen bir ürün fark edilmeden "stokta" görünmeye devam edebiliyordu).
async function handle(
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
    const result = await restockSupplierProducts(db, supplier);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Stok güncellenemedi." },
      { status: 500 },
    );
  }
}

export const POST = handle;
// GET too: tarayıcı adres çubuğundan doğrudan tetiklenebilsin diye.
export const GET = handle;
