import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { getShopifyAccessToken } from "../../../../../../lib/shopify/auth";
import { shopifyGraphQL } from "../../../../../../lib/shopify/client";
import { getMainThemeId, getThemeFile } from "../../../../../../lib/shopify/theme";
import { getD1 } from "../../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Debug-only: dumps live theme files into D1 so they can be inspected via a
// direct database query instead of a browser call - this endpoint requires
// an authenticated admin session, which isn't available from a non-browser
// context.
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

async function upsertDebug(db: D1Database, key: string, content: string) {
  await db
    .prepare(
      `INSERT INTO shopify_theme_debug (key, content, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(key, content)
    .run();
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const accessToken = await getShopifyAccessToken();

    const shopData = await shopifyGraphQL<{
      shopLocales: { locale: string; primary: boolean; published: boolean }[];
    }>(
      accessToken,
      `query {
        shopLocales { locale primary published }
      }`,
      {},
    );

    const themeId = await getMainThemeId(accessToken);
    const trLocale = await getThemeFile(accessToken, themeId, "locales/tr.json");
    const trDefaultLocale = await getThemeFile(accessToken, themeId, "locales/tr.default.json");
    const enDefaultLocale = await getThemeFile(accessToken, themeId, "locales/en.default.json");

    const result = {
      shopLocales: shopData.shopLocales,
      hasTrLocale: trLocale !== null,
      hasTrDefaultLocale: trDefaultLocale !== null,
      enDefaultSnippet: enDefaultLocale?.slice(0, 800) ?? null,
    };
    const dump = JSON.stringify(result, null, 2);

    const db = getD1();
    await ensureDebugTable(db);
    await upsertDebug(db, "localeInfo", dump);

    return Response.json(result);
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
