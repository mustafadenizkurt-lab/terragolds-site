import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import { getD1 } from "../../../../lib/store-db";
import {
  buildReport,
  fetchFeedRecords,
  type CandidateProduct,
} from "../../../../lib/xml-code-backfill";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const supplierId = Number(body.supplierId);
    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      return Response.json({ error: "Tedarikçi seçilmedi." }, { status: 400 });
    }
    const codeField = body.codeField ? String(body.codeField) : undefined;
    const imageField = body.imageField ? String(body.imageField) : undefined;
    const commit = Boolean(body.commit);

    const db = getD1();
    const supplier = await db
      .prepare("SELECT id, name, feed_url AS feedUrl FROM xml_suppliers WHERE id = ?")
      .bind(supplierId)
      .first<{ id: number; name: string; feedUrl: string }>();
    if (!supplier) {
      return Response.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });
    }

    const records = await fetchFeedRecords(supplier.feedUrl);

    // Every existing product with no code yet is a candidate, regardless of
    // whether it was ever linked to this supplier row - the historical bulk
    // "Tedarikçi İçe Aktar" imports never set xml_supplier_id at all, so
    // restricting to xml_supplier_id = ? would miss almost everything.
    const { results: candidates } = await db
      .prepare(
        `SELECT id, name, image FROM products
         WHERE (xml_external_id IS NULL OR xml_external_id = '') AND image <> ''`,
      )
      .all<CandidateProduct>();

    const { report, matches } = buildReport(records, candidates, {
      codeField,
      imageField,
    });

    if (!commit) {
      return Response.json({ report });
    }

    if (matches.length) {
      const statements = matches.map((match) =>
        db
          .prepare(
            `UPDATE products SET xml_supplier_id = ?, xml_external_id = ? WHERE id = ?`,
          )
          .bind(supplier.id, match.externalId, match.productId),
      );
      // D1 batches are capped well above this, but chunk defensively so a
      // large backfill (thousands of matches) can't exceed a single batch's
      // statement limit.
      const CHUNK_SIZE = 500;
      for (let index = 0; index < statements.length; index += CHUNK_SIZE) {
        await db.batch(statements.slice(index, index + CHUNK_SIZE));
      }
    }

    return Response.json({ report, updated: matches.length });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ürün kodu eşleştirmesi tamamlanamadı.",
      },
      { status: 400 },
    );
  }
}
