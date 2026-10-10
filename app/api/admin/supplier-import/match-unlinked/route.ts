import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import { fetchFeed } from "../../../../../lib/xml-sync/fetchFeed";
import { parseFeed } from "../../../../../lib/xml-sync/parseFeed";
import { mapRecord, type Supplier, type SupplierMapping } from "../../../../../lib/xml-sync/syncSupplier";

export const dynamic = "force-dynamic";

// Teşhis aracı: xml_supplier_id'si NULL olan (yani sürekli senkrona hiç
// bağlı olmayan) ürünlerden kaçı, aktif tedarikçinin GÜNCEL feed'inde hâlâ
// mevcut? "Tedarikçi İçe Aktarma" aracıyla (bkz. app/api/admin/
// supplier-import/commit) tek seferlik aktarılan ürünler xml_supplier_id
// hiç yazılmadan oluşturuluyordu - içerikleri gerçekten tedarikçiden gelse
// bile sistem onları "elle eklenmiş" sanıyor, sürekli senkrona hiç girmiyor.
// Bu route hiçbir şeyi değiştirmiyor (salt önizleme) - eşleşenleri gerçekten
// bağlamak (xml_supplier_id/xml_external_id yazmak) ayrı bir adım.
//
// Eşleştirme önce GÖRSEL URL'siyle deneniyor (SKU başına tipik olarak eşsiz,
// en güvenilir sinyal), olmazsa ürün adıyla (normalize edilmiş) deneniyor.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const db = getD1();
  try {
    const unlinked = await db
      .prepare(
        `SELECT id, name, image, status FROM products
         WHERE xml_supplier_id IS NULL AND xml_external_id IS NULL
         ORDER BY id`,
      )
      .all<{ id: number; name: string; image: string; status: string }>();

    const supplier = await db
      .prepare(
        `SELECT id, name, feed_url AS feedUrl, field_mapping AS fieldMapping
         FROM xml_suppliers WHERE active = 1 LIMIT 1`,
      )
      .first<Pick<Supplier, "id" | "name" | "feedUrl" | "fieldMapping">>();

    if (!supplier) {
      return Response.json({ error: "Aktif tedarikçi bulunamadı." }, { status: 400 });
    }

    const mapping = JSON.parse(supplier.fieldMapping || "{}") as SupplierMapping;
    const records = parseFeed(await fetchFeed(supplier.feedUrl));
    const mapped = records.map((record) => mapRecord(record, mapping));

    const byImage = new Map<string, (typeof mapped)[number]>();
    const byName = new Map<string, (typeof mapped)[number]>();
    const normalizeName = (value: string) => value.trim().toLocaleLowerCase("tr-TR");
    for (const product of mapped) {
      if (product.image && !byImage.has(product.image)) byImage.set(product.image, product);
      const normalized = normalizeName(product.name);
      if (normalized && !byName.has(normalized)) byName.set(normalized, product);
    }

    const matched: {
      id: number;
      name: string;
      status: string;
      matchedBy: "image" | "name";
      externalId: string;
      feedName: string;
    }[] = [];
    const unmatched: { id: number; name: string; status: string; image: string }[] = [];

    for (const product of unlinked.results) {
      const imageMatch = product.image ? byImage.get(product.image) : undefined;
      const nameMatch = !imageMatch ? byName.get(normalizeName(product.name)) : undefined;
      const hit = imageMatch ?? nameMatch;
      if (hit && hit.externalId) {
        matched.push({
          id: product.id,
          name: product.name,
          status: product.status,
          matchedBy: imageMatch ? "image" : "name",
          externalId: hit.externalId,
          feedName: hit.name,
        });
      } else {
        unmatched.push({ id: product.id, name: product.name, status: product.status, image: product.image });
      }
    }

    return Response.json({
      supplierId: supplier.id,
      supplierName: supplier.name,
      totalUnlinked: unlinked.results.length,
      feedRecordCount: records.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      matched,
      unmatched,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Eşleştirme başarısız oldu." },
      { status: 400 },
    );
  }
}
