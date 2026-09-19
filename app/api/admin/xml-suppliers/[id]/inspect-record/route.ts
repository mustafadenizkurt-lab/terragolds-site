import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { fetchFeed } from "../../../../../../lib/xml-sync/fetchFeed";
import { parseFeed, readMappedValue } from "../../../../../../lib/xml-sync/parseFeed";
import { getD1 } from "../../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Teşhis aracı: tedarikçinin ham feed'inde tek bir kaydın TAM yapısını
// gösterir - "resim" alanının resim1 dışında resim2/resim3 gibi başka
// fotoğraflar içerip içermediğini kontrol etmek için (kod tabanı şu an
// sadece resim1'i çekiyor). ?externalId= verilirse (stok_kodu) o kayıt
// bulunur, verilmezse feed'deki ilk kayıt döner.
export async function GET(
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Geçersiz tedarikçi id'si." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const externalId = searchParams.get("externalId");

  const db = getD1();
  const supplier = await db
    .prepare(
      "SELECT id, feed_url AS feedUrl, field_mapping AS fieldMapping FROM xml_suppliers WHERE id = ?",
    )
    .bind(id)
    .first<{ id: number; feedUrl: string; fieldMapping: string }>();
  if (!supplier) {
    return Response.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });
  }

  try {
    const mapping = JSON.parse(supplier.fieldMapping || "{}") as { externalId?: string };
    const records = parseFeed(await fetchFeed(supplier.feedUrl));

    const record = externalId
      ? records.find((r) => readMappedValue(r, mapping.externalId) === externalId)
      : records[0];

    if (!record) {
      return Response.json({ error: "Kayıt bulunamadı.", totalRecords: records.length });
    }

    return Response.json({ totalRecords: records.length, record });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Feed okunamadı." },
      { status: 500 },
    );
  }
}
