import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  getCategoryAttributes,
  getCategoryAttributesRaw,
  getCategoryAttributeValues,
  getCategoryAttributeValuesRaw,
} from "../../../../../lib/trendyol/client";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Geçici teşhis tablosu - ham Trendyol yanıtları mobil ekranda kopyalanamayacak
// kadar büyük olabildiği için buraya yazılıyor, D1'den doğrudan okunuyor.
// attribute_id, kategori özellik LİSTESİ için 0 (özellik adları/zorunluluk),
// belirli bir özelliğin DEĞER listesi için gerçek attributeId.
async function ensureDiagnosticsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS trendyol_diagnostics_v2 (
        category_id INTEGER NOT NULL,
        attribute_id INTEGER NOT NULL DEFAULT 0,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (category_id, attribute_id)
      )`,
    )
    .run();
}

async function writeDiagnostics(
  db: D1Database,
  categoryId: number,
  attributeId: number,
  raw: unknown,
) {
  await ensureDiagnosticsTable(db);
  await db
    .prepare(
      `INSERT INTO trendyol_diagnostics_v2 (category_id, attribute_id, response, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(category_id, attribute_id) DO UPDATE SET
         response = excluded.response, created_at = CURRENT_TIMESTAMP`,
    )
    .bind(categoryId, attributeId, JSON.stringify(raw))
    .run();
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const categoryId = Number(searchParams.get("categoryId"));
  if (!categoryId) {
    return Response.json({ error: "Geçerli bir kategori ID gerekli." }, { status: 400 });
  }

  // Geçici teşhis modu: Trendyol'un işlenmemiş yanıtını olduğu gibi döner.
  // attributeIds (virgülle ayrılmış, birden fazla olabilir) verilmişse, her
  // biri için DEĞER listesini (Kategori Özellik Değerleri Listesi v2) tek
  // istekte toplar - kategori özellik listesi (aşağıdaki) sadece özellik
  // adlarını/zorunluluğunu içeriyor, gerçek değerler ayrı bir sayfalı
  // serviste. Yanıt mobil ekranda kopyalanamayacak kadar büyük
  // olabileceğinden D1'e de yazılıyor.
  if (searchParams.get("raw") === "1") {
    const attributeIdsParam = searchParams.get("attributeIds") ?? searchParams.get("attributeId");
    let attributeIds = (attributeIdsParam ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => value > 0);

    // Sayısal ID'yi elle yazarken/kopyalarken bir hane düşürülebiliyor
    // (ör. "338" -> "33") - bu yüzden özellik adının tamamı ya da bir kısmı
    // (ör. "Beden") ile de aranabiliyor, ID hiç yazılmadan.
    const attributeNameParam = searchParams.get("attributeName");
    if (attributeIds.length === 0 && attributeNameParam) {
      const search = attributeNameParam.toLocaleLowerCase("tr-TR");
      const attributes = await getCategoryAttributes(categoryId);
      attributeIds = attributes
        .filter((attribute) =>
          (attribute.attribute?.name ?? "").toLocaleLowerCase("tr-TR").includes(search),
        )
        .map((attribute) => attribute.attribute?.id ?? 0)
        .filter((id) => id > 0);
      if (attributeIds.length === 0) {
        return Response.json(
          { error: `"${attributeNameParam}" adıyla eşleşen özellik bulunamadı.` },
          { status: 404 },
        );
      }
    }

    const db = getD1();
    try {
      if (attributeIds.length === 0) {
        const raw = await getCategoryAttributesRaw(categoryId);
        await writeDiagnostics(db, categoryId, 0, raw);
        return Response.json(raw);
      }

      // Bazı özelliklerin (ör. Beden) onlarca sayfa değeri var - tek tek
      // sayfa gezmek yerine "search" verilirse tüm sayfaları kendimiz
      // toplayıp içinde geçen değerleri filtreliyoruz (ör. "Standart",
      // "TR" gibi jewelry'ye uygun bir varsayılan aramak için).
      const search = searchParams.get("search")?.toLocaleLowerCase("tr-TR");
      const byAttributeId: Record<string, unknown> = {};
      for (const attributeId of attributeIds) {
        if (search) {
          const all = await getCategoryAttributeValues(categoryId, attributeId);
          const matches = all.filter((value) =>
            value.attributeValue.toLocaleLowerCase("tr-TR").includes(search),
          );
          byAttributeId[attributeId] = { totalMatches: matches.length, matches: matches.slice(0, 50) };
        } else {
          const raw = await getCategoryAttributeValuesRaw(categoryId, attributeId);
          await writeDiagnostics(db, categoryId, attributeId, raw);
          byAttributeId[attributeId] = raw;
        }
      }
      return Response.json(byAttributeId);
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
