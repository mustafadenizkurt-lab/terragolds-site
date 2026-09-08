import { SHOPIFY_SHOP_DOMAIN } from "./auth";

export const SHOPIFY_API_VERSION = "2026-07";
export const SITE_ORIGIN = "https://www.terragolds.com";

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function shopifyGraphQL<T>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Shopify API isteği başarısız (${response.status}): ${await response.text()}`,
    );
  }
  const body = (await response.json()) as ShopifyGraphQLResponse<T>;
  if (body.errors?.length) {
    throw new Error(
      `Shopify GraphQL hatası: ${body.errors.map((error) => error.message).join(", ")}`,
    );
  }
  if (!body.data) {
    throw new Error("Shopify yanıtında veri bulunamadı.");
  }
  return body.data;
}

// Sonuçları cron çalıştırmaları arasında önbelleğe almıyoruz - tek bir
// sorgu maliyeti ihmal edilebilir düzeyde, bu da ilk lokasyonun silinip
// yenisinin eklendiği bir senaryoda bile eski bir ID'ye takılı kalmayı
// önler.
export async function getPrimaryLocationId(
  accessToken: string,
): Promise<string> {
  const data = await shopifyGraphQL<{
    locations: { edges: { node: { id: string } }[] };
  }>(
    accessToken,
    `query { locations(first: 1) { edges { node { id } } } }`,
    {},
  );
  const locationId = data.locations.edges[0]?.node.id;
  if (!locationId) {
    throw new Error("Shopify mağazasında hiç lokasyon (depo) bulunamadı.");
  }
  return locationId;
}

export async function ensureShopifyColumns(db: D1Database) {
  const columns = await db
    .prepare("PRAGMA table_info(products)")
    .all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("shopify_product_id")) {
    await db
      .prepare("ALTER TABLE products ADD COLUMN shopify_product_id TEXT")
      .run();
  }
  if (!names.has("shopify_synced_at")) {
    await db
      .prepare("ALTER TABLE products ADD COLUMN shopify_synced_at TEXT")
      .run();
  }
  if (!names.has("shopify_inventory_item_id")) {
    await db
      .prepare(
        "ALTER TABLE products ADD COLUMN shopify_inventory_item_id TEXT",
      )
      .run();
  }
  if (!names.has("shopify_published_at")) {
    await db
      .prepare("ALTER TABLE products ADD COLUMN shopify_published_at TEXT")
      .run();
  }
}

// A product's `status: ACTIVE` alone doesn't make it appear on the Online
// Store - Shopify treats each sales channel as a separate "publication" that
// a product must be explicitly published to (see publishablePublish). Not
// caching this across calls for the same reason we don't cache the location
// id: the query is cheap and this avoids ever holding a stale id.
export async function getOnlineStorePublicationId(
  accessToken: string,
): Promise<string> {
  const data = await shopifyGraphQL<{
    publications: { nodes: { id: string; name: string }[] };
  }>(
    accessToken,
    `query { publications(first: 25) { nodes { id name } } }`,
    {},
  );
  const publication = data.publications.nodes.find(
    (node) => node.name === "Online Store",
  );
  if (!publication) {
    throw new Error("Shopify mağazasında 'Online Store' satış kanalı bulunamadı.");
  }
  return publication.id;
}

// Shopify rejects `files.originalSource` unless it's a well-formed, absolute
// URL. Product images in D1 aren't always that: some are relative paths
// from our own media API (no domain), and some are absolute URLs copied
// from the supplier feed containing a literal space or an un-encoded
// Turkish character (e.g. "İ") in the path - all three read fine in a
// browser (which encodes on the fly) but are invalid as a raw URI string.
export function toAbsoluteImageUrl(image: string): string | null {
  if (!image) return null;
  const absolute = /^https?:\/\//i.test(image)
    ? image
    : `${SITE_ORIGIN}${image.startsWith("/") ? "" : "/"}${image}`;
  try {
    // Percent-encodes spaces/non-ASCII characters; idempotent on a URL
    // that's already properly encoded, since encodeURI leaves "%" alone.
    return encodeURI(absolute);
  } catch {
    return null;
  }
}
