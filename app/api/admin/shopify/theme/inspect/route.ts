import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { getShopifyAccessToken } from "../../../../../../lib/shopify/auth";
import { getMainThemeId, getThemeFile } from "../../../../../../lib/shopify/theme";
import { getD1 } from "../../../../../../lib/store-db";
import { shopifyGraphQL } from "../../../../../../lib/shopify/client";

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

    // Products with real stock are showing "Unavailable" on the storefront -
    // a location not enabled to fulfill online orders is the classic cause,
    // so dump the shop's locations (and the Online Store publication's own
    // catalog/location settings) to check that theory.
    const locations = await shopifyGraphQL<{
      locations: {
        nodes: {
          id: string;
          name: string;
          fulfillsOnlineOrders: boolean;
          isActive: boolean;
        }[];
      };
    }>(
      accessToken,
      `query { locations(first: 25) { nodes { id name fulfillsOnlineOrders isActive } } }`,
      {},
    );

    // Ruled out the location theory above (both fulfill online orders) -
    // check the actual variant/inventory state of a known in-stock product
    // instead: availableForSale, inventory policy, and per-location levels.
    const productCheck = await shopifyGraphQL<{
      product: {
        id: string;
        status: string;
        variants: {
          nodes: {
            id: string;
            availableForSale: boolean;
            inventoryPolicy: string;
            inventoryQuantity: number;
            inventoryItem: {
              tracked: boolean;
              inventoryLevels: {
                nodes: {
                  location: { name: string };
                  quantities: { name: string; quantity: number }[];
                }[];
              };
            };
          }[];
        };
      } | null;
    }>(
      accessToken,
      `query product($id: ID!) {
        product(id: $id) {
          id
          status
          variants(first: 5) {
            nodes {
              id
              availableForSale
              inventoryPolicy
              inventoryQuantity
              inventoryItem {
                tracked
                inventoryLevels(first: 10) {
                  nodes {
                    location { name }
                    quantities(names: ["available"]) { name quantity }
                  }
                }
              }
            }
          }
        }
      }`,
      { id: "gid://shopify/Product/10253992263920" },
    );

    const db = getD1();
    await ensureDebugTable(db);
    await Promise.all([
      upsertDebug(db, "themeId", themeId),
      upsertDebug(db, "settingsData", settingsData ?? ""),
      upsertDebug(db, "settingsSchema", settingsSchema ?? ""),
      upsertDebug(db, "locations", JSON.stringify(locations.locations.nodes)),
      upsertDebug(db, "productCheck", JSON.stringify(productCheck.product)),
    ]);

    return Response.json({
      themeId,
      settingsDataLength: settingsData?.length ?? 0,
      settingsSchemaLength: settingsSchema?.length ?? 0,
      locations: locations.locations.nodes,
      productCheck: productCheck.product,
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
