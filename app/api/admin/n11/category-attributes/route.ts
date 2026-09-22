import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  getCategoryAttributes,
  getCategoryAttributesRaw,
} from "../../../../../lib/n11/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const categoryId = Number(searchParams.get("categoryId"));
  if (!categoryId) {
    return Response.json({ error: "Geçerli bir kategori ID gerekli." }, { status: 400 });
  }

  // Ham teşhis modu: client.ts'teki N11CategoryAttribute varsayımlarını
  // (isMandatory/isCustomValue/isVariant alan adları) gerçek yanıtla
  // doğrulamak için - Trendyol'daki category-attributes route'undaki raw
  // mod ile aynı amaç.
  if (searchParams.get("raw") === "1") {
    try {
      return Response.json(await getCategoryAttributesRaw(categoryId));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "N11 isteği başarısız." },
        { status: 400 },
      );
    }
  }

  try {
    const attributes = await getCategoryAttributes(categoryId);
    return Response.json({ attributes });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "N11 kategori özellikleri alınamadı.",
      },
      { status: 400 },
    );
  }
}
