import { getRequiredEnv } from "../runtime-env";

export const SHOPIFY_SHOP_DOMAIN = "x9aqw8-c0.myshopify.com";
// Client credentials grant tokens always expire in 24h with no refresh
// token (Shopify's own docs: expires_in is always 86399) - rather than
// track expiry and cache across Worker invocations, each sync run just
// requests a fresh token itself. Sync runs are infrequent (a cron every
// few hours, or an admin-triggered one-off), so the extra request per run
// is negligible and this avoids stale-token failures entirely.
export async function getShopifyAccessToken(): Promise<string> {
  const clientId = getRequiredEnv("SHOPIFY_CLIENT_ID");
  const clientSecret = getRequiredEnv("SHOPIFY_CLIENT_SECRET");

  const response = await fetch(
    `https://${SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Shopify access token alınamadı (${response.status}): ${await response.text()}`,
    );
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Shopify yanıtında access_token bulunamadı.");
  }
  return data.access_token;
}
