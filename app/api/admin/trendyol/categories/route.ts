import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  getCategories,
  flattenTrendyolCategories,
} from "../../../../../lib/trendyol/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? undefined;

  try {
    const categories = await getCategories(name);
    const flat = flattenTrendyolCategories(categories).slice(0, 50);
    return Response.json({ categories: flat });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Trendyol kategorileri alınamadı.",
      },
      { status: 400 },
    );
  }
}
