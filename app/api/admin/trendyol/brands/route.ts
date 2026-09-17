import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getBrandsByName } from "../../../../../lib/trendyol/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) {
    return Response.json({ error: "Aranacak kelime gerekli." }, { status: 400 });
  }

  try {
    const brands = await getBrandsByName(name);
    return Response.json({ brands: brands.slice(0, 50) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Trendyol markaları alınamadı.",
      },
      { status: 400 },
    );
  }
}
