import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { getShopifyAccessToken } from "../../../../../../lib/shopify/auth";
import { applyProductPageLayout, getMainThemeId } from "../../../../../../lib/shopify/theme";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const accessToken = await getShopifyAccessToken();
    const themeId = await getMainThemeId(accessToken);
    await applyProductPageLayout(accessToken, themeId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Ürün sayfası güncellenemedi.",
      },
      { status: 500 },
    );
  }
}
