import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { getShopifyAccessToken } from "../../../../../../lib/shopify/auth";
import { getMainThemeId, getThemeFile } from "../../../../../../lib/shopify/theme";
import { getD1 } from "../../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Debug-only: dumps the live theme's settings JSON into D1 so it can be
// inspected via a direct database query instead of a browser call - this
// endpoint requires an authenticated admin session, which isn't available
// from a non-browser context.
async function ensureDebugTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS shopify_theme_debug (
        key TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

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

    const db = getD1();
    await ensureDebugTable(db);
    await db.batch([
      db
        .prepare(
          `INSERT INTO shopify_theme_debug (key, content, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind("themeId", themeId),
      db
        .prepare(
          `INSERT INTO shopify_theme_debug (key, content, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind("settingsData", settingsData ?? ""),
      db
        .prepare(
          `INSERT INTO shopify_theme_debug (key, content, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind("settingsSchema", settingsSchema ?? ""),
    ]);

    return Response.json({
      themeId,
      settingsDataLength: settingsData?.length ?? 0,
      settingsSchemaLength: settingsSchema?.length ?? 0,
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
