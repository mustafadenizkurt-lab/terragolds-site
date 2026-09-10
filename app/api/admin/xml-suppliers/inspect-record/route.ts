import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { fetchFeed } from "../../../../../lib/xml-sync/fetchFeed";
import { parseFeed, readMappedValue } from "../../../../../lib/xml-sync/parseFeed";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Debug-only: fetches a supplier's live XML feed (from the Worker, not this
// sandbox - the feed host isn't reachable from here) and dumps every field
// on one record so we can see whether a "suggested retail price" field
// exists that the current field_mapping isn't using.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const url = new URL(request.url);
    const supplierId = url.searchParams.get("supplierId");
    const externalId = url.searchParams.get("externalId");
    if (!supplierId || !externalId) {
      return Response.json({ error: "supplierId ve externalId gerekli." }, { status: 400 });
    }

    const db = getD1();
    const supplier = await db
      .prepare("SELECT feed_url AS feedUrl, field_mapping AS fieldMapping FROM xml_suppliers WHERE id = ?")
      .bind(supplierId)
      .first<{ feedUrl: string; fieldMapping: string }>();
    if (!supplier) {
      return Response.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });
    }

    const mapping = JSON.parse(supplier.fieldMapping || "{}") as { externalId?: string };
    const xml = await fetchFeed(supplier.feedUrl);
    const records = parseFeed(xml);
    const record = records.find((candidate) => readMappedValue(candidate, mapping.externalId) === externalId);
    if (!record) {
      return Response.json({ error: `${externalId} kodlu kayıt feed'de bulunamadı.` }, { status: 404 });
    }

    const dump = JSON.stringify(record, null, 2);
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS shopify_theme_debug (
          key TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO shopify_theme_debug (key, content, updated_at)
         VALUES ('xmlRecord', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(dump)
      .run();

    return Response.json({ recordLength: dump.length, fieldCount: Object.keys(record).length });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Kayıt incelenemedi." },
      { status: 500 },
    );
  }
}
