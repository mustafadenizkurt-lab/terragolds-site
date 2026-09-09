import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { getShopifyAccessToken } from "../../../../../../lib/shopify/auth";
import { getMainThemeId, getThemeFile } from "../../../../../../lib/shopify/theme";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const accessToken = await getShopifyAccessToken();
    const themeId = await getMainThemeId(accessToken);
    const settingsData = await getThemeFile(
      accessToken,
      themeId,
      "config/settings_data.json",
    );
    const settingsSchema = await getThemeFile(
      accessToken,
      themeId,
      "config/settings_schema.json",
    );
    return Response.json({
      themeId,
      settingsData: settingsData ? JSON.parse(settingsData) : null,
      settingsSchema: settingsSchema ? JSON.parse(settingsSchema) : null,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Tema incelenemedi.",
      },
      { status: 500 },
    );
  }
}
