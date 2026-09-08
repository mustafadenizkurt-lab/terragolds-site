import { getShopifyAccessToken, SHOPIFY_SHOP_DOMAIN } from "./auth";

const SHOPIFY_API_VERSION = "2026-07";
const SITE_ORIGIN = "https://www.terragolds.com";

// Shopify rejects `files.originalSource` unless it's a well-formed, absolute
// URL. Product images in D1 aren't always that: some are relative paths
// from our own media API (no domain), and some are absolute URLs copied
// from the supplier feed containing a literal space or an un-encoded
// Turkish character (e.g. "İ") in the path - all three read fine in a
// browser (which encodes on the fly) but are invalid as a raw URI string.
function toAbsoluteImageUrl(image: string): string | null {
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

type PendingProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  category: string;
};

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

async function ensureShopifyColumns(db: D1Database) {
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
}

async function shopifyGraphQL<T>(
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
async function getPrimaryLocationId(accessToken: string): Promise<string> {
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

async function createShopifyProduct(
  accessToken: string,
  locationId: string,
  product: PendingProduct,
): Promise<string> {
  const imageUrl = toAbsoluteImageUrl(product.image);
  const data = await shopifyGraphQL<{
    productSet: {
      product: { id: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation productSet($input: ProductSetInput!) {
      productSet(synchronous: true, input: $input) {
        product { id }
        userErrors { field message }
      }
    }`,
    {
      input: {
        title: product.name,
        descriptionHtml: product.description,
        productType: product.category,
        status: "ACTIVE",
        productOptions: [
          { name: "Title", values: [{ name: "Default Title" }] },
        ],
        variants: [
          {
            optionValues: [
              { optionName: "Title", name: "Default Title" },
            ],
            // products.price is stored as a plain TL amount (not kuruş) -
            // see lib/cart-pricing.ts's `getDiscountedPrice(product) * 100`,
            // which converts TL to kuruş for its own internal math.
            price: product.price.toFixed(2),
            inventoryQuantities: [
              {
                locationId,
                name: "available",
                quantity: product.stock,
              },
            ],
          },
        ],
        files: imageUrl
          ? [{ originalSource: imageUrl, contentType: "IMAGE" }]
          : undefined,
      },
    },
  );
  const productId = data.productSet.product?.id;
  if (data.productSet.userErrors.length || !productId) {
    throw new Error(
      data.productSet.userErrors.map((error) => error.message).join(", ") ||
        "Shopify ürünü oluşturulamadı.",
    );
  }
  return productId;
}

export type ShopifySyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

export async function syncProductsToShopify(
  db: D1Database,
  batchSize = 25,
): Promise<ShopifySyncResult> {
  await ensureShopifyColumns(db);

  const pending = await db
    .prepare(
      `SELECT id, name, description, price, stock, image, category FROM products
       WHERE status = 'published' AND shopify_product_id IS NULL
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<PendingProduct>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM products WHERE status = 'published' AND shopify_product_id IS NULL",
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  if (pending.results.length === 0) {
    return { created: 0, failed: 0, remaining: 0, errors: [] };
  }

  const accessToken = await getShopifyAccessToken();
  const locationId = await getPrimaryLocationId(accessToken);

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const product of pending.results) {
    try {
      const shopifyId = await createShopifyProduct(
        accessToken,
        locationId,
        product,
      );
      await db
        .prepare(
          "UPDATE products SET shopify_product_id = ?, shopify_synced_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(shopifyId, product.id)
        .run();
      created += 1;
    } catch (error) {
      failed += 1;
      errors.push(
        `#${product.id} ${product.name}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
      );
    }
  }

  return { created, failed, remaining: await remainingCount(), errors };
}
