import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getCategoryAttributes, getCategoryAttributesRaw } from "../../../../../lib/trendyol/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const categoryId = Number(searchParams.get("categoryId"));
  if (!categoryId) {
    return Response.json({ error: "Geçerli bir kategori ID gerekli." }, { status: 400 });
  }

  // Geçici teşhis modu: Trendyol'un işlenmemiş yanıtını olduğu gibi döner -
  // attributeValues'ın gerçek şeklini (boş mu geliyor yoksa bizim eşleme
  // kodumuz mu yanlış okuyor) doğrulamak için.
  if (searchParams.get("raw") === "1") {
    try {
      const raw = await getCategoryAttributesRaw(categoryId);
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
