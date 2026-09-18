import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getCategoryAttributes, getCategoryAttributesRaw } from "../../../../../lib/trendyol/client";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Geçici teşhis tablosu - ham Trendyol yanıtları mobil ekranda kopyalanamayacak
// kadar büyük olabildiği için buraya yazılıyor, D1'den doğrudan okunuyor.
async function ensureDiagnosticsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS trendyol_diagnostics (
        category_id INTEGER PRIMARY KEY,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const categoryId = Number(searchParams.get("categoryId"));
  if (!categoryId) {
    return Response.json({ error: "Geçerli bir kategori ID gerekli." }, { status: 400 });
  }

  // Geçici teşhis modu: Trendyol'un işlenmemiş yanıtını olduğu gibi döner -
  // attributeValues'ın gerçek şeklini (boş mu geliyor yoksa bizim eşleme
  // kodumuz mu yanlış okuyor) doğrulamak için. Yanıt mobil ekranda
  // kopyalanamayacak kadar büyük olabileceğinden D1'e de yazılıyor.
  if (searchParams.get("raw") === "1") {
    try {
      const raw = await getCategoryAttributesRaw(categoryId);
      const db = getD1();
      await ensureDiagnosticsTable(db);
      await db
        .prepare(
          `INSERT INTO trendyol_diagnostics (category_id, response, created_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(category_id) DO UPDATE SET
             response = excluded.response, created_at = CURRENT_TIMESTAMP`,
        )
        .bind(categoryId, JSON.stringify(raw))
        .run();
      return Response.json(raw);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Trendyol isteği başarısız." },
        { status: 400 },
      );
    }
  }

  try {
    const attributes = await getCategoryAttributes(categoryId);
    return Response.json({
      attributes: attributes.map((attribute) => ({
        id: attribute.attribute?.id ?? 0,
        name: attribute.attribute?.name ?? "",
        required: Boolean(attribute.required),
        allowCustom: Boolean(attribute.allowCustom),
        values: (attribute.attributeValues ?? []).slice(0, 20).map((value) => ({
          id: value.id,
          name: value.name,
        })),
      })),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Trendyol kategori özellikleri alınamadı.",
      },
      { status: 400 },
    );
  }
}
