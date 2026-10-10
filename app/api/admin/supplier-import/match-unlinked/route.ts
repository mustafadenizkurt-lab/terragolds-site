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
    const stillUnmatched: { id: number; name: string; status: string; image: string }[] = [];

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
        stillUnmatched.push({ id: product.id, name: product.name, status: product.status, image: product.image });
      }
    }

    // Tam eşleşme bulunamayan kalanlar için iki bulanık (fuzzy) ipucu daha:
    // 1) Güncel feed'de benzer isimli bir kayıt var mı (tedarikçi ismi/fotoğrafı
    //    zamanla değiştirmiş olabilir - tam eşleşme bunu yakalamıyor).
    // 2) Kendi kataloğumuzda (bu tedarikçiye ZATEN bağlı, senkronlu) benzer
    //    isimli bir ürün var mı - ilk 6 eşleşmede olduğu gibi bu, "aslında
    //    zaten doğru şekilde takip edilen bir kopyası var" ihtimalini yakalar.
    // Basit token (kelime) kesişimi / Jaccard benzerliği - ağır bir kütüphane
    // gerektirmiyor, bu ölçekte (28 x ~4000-5000) yeterince hızlı.
    const tokenize = (value: string): Set<string> =>
      new Set(
        value
          .toLocaleLowerCase("tr-TR")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length >= 3),
      );
    const jaccard = (a: Set<string>, b: Set<string>): number => {
      if (a.size === 0 || b.size === 0) return 0;
      let intersection = 0;
      for (const token of a) if (b.has(token)) intersection += 1;
      const union = a.size + b.size - intersection;
      return union === 0 ? 0 : intersection / union;
    };
    const bestMatch = <T,>(
      targetTokens: Set<string>,
      candidates: { tokens: Set<string>; item: T }[],
    ): { item: T; score: number } | null => {
      let best: { item: T; score: number } | null = null;
      for (const candidate of candidates) {
        const score = jaccard(targetTokens, candidate.tokens);
        if (score >= 0.5 && (!best || score > best.score)) best = { item: candidate.item, score };
      }
      return best;
    };

    const feedCandidates = mapped
      .filter((product) => product.externalId)
      .map((product) => ({ tokens: tokenize(product.name), item: product }));

    const ownCatalog = await db
      .prepare(
        `SELECT id, name, status, price, stock FROM products
         WHERE xml_supplier_id = ? AND xml_sync_status = 'synced'`,
      )
      .bind(supplier.id)
      .all<{ id: number; name: string; status: string; price: number; stock: number }>();
    const catalogCandidates = ownCatalog.results.map((product) => ({
      tokens: tokenize(product.name),
      item: product,
    }));

    const unmatched = stillUnmatched.map((product) => {
      const targetTokens = tokenize(product.name);
      const feedHit = bestMatch(targetTokens, feedCandidates);
      const catalogHit = bestMatch(targetTokens, catalogCandidates);
      return {
        ...product,
        fuzzyFeedCandidate: feedHit
          ? { name: feedHit.item.name, externalId: feedHit.item.externalId, score: Math.round(feedHit.score * 100) / 100 }
          : null,
        fuzzyCatalogDuplicate: catalogHit
          ? {
              id: catalogHit.item.id,
              name: catalogHit.item.name,
              status: catalogHit.item.status,
              price: catalogHit.item.price,
              stock: catalogHit.item.stock,
              score: Math.round(catalogHit.score * 100) / 100,
            }
          : null,
      };
    });

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
