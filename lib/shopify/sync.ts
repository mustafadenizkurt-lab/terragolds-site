import { getShopifyAccessToken } from "./auth";
import {
  ensureShopifyColumns,
  getPrimaryLocationId,
  shopifyGraphQL,
  toAbsoluteImageUrl,
} from "./client";
import { ensureShopifyWebhooksRegistered } from "./webhooks";

type PendingProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  category: string;
};

async function createShopifyProduct(
  accessToken: string,
  locationId: string,
  product: PendingProduct,
): Promise<{ productId: string; inventoryItemId: string | null }> {
  const imageUrl = toAbsoluteImageUrl(product.image);
  const data = await shopifyGraphQL<{
    productSet: {
      product: {
        id: string;
        variants: { nodes: { inventoryItem: { id: string } }[] };
      } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation productSet($input: ProductSetInput!) {
      productSet(synchronous: true, input: $input) {
        product {
          id
          variants(first: 1) {
            nodes { inventoryItem { id } }
          }
        }
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
  return {
    productId,
    inventoryItemId:
      data.productSet.product?.variants.nodes[0]?.inventoryItem.id ?? null,
  };
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

  const accessToken = await getShopifyAccessToken();
  // Idempotent and cheap - also self-heals if someone deletes a webhook
  // subscription from the Shopify admin side.
  await ensureShopifyWebhooksRegistered(accessToken);

  if (pending.results.length === 0) {
    return { created: 0, failed: 0, remaining: 0, errors: [] };
  }

  const locationId = await getPrimaryLocationId(accessToken);

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const product of pending.results) {
    try {
      const { productId, inventoryItemId } = await createShopifyProduct(
        accessToken,
        locationId,
        product,
      );
      await db
        .prepare(
          `UPDATE products SET shopify_product_id = ?, shopify_inventory_item_id = ?,
           shopify_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(productId, inventoryItemId, product.id)
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
