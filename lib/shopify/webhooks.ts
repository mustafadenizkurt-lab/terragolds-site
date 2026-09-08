import { shopifyGraphQL, SITE_ORIGIN } from "./client";

export const ORDERS_PAID_WEBHOOK_URL = `${SITE_ORIGIN}/api/webhooks/shopify/orders-paid`;
export const ORDERS_CREATE_WEBHOOK_URL = `${SITE_ORIGIN}/api/webhooks/shopify/orders-create`;

async function ensureWebhookRegistered(
  accessToken: string,
  topic: string,
  callbackUrl: string,
): Promise<void> {
  const existing = await shopifyGraphQL<{
    webhookSubscriptions: { nodes: { callbackUrl: string }[] };
  }>(
    accessToken,
    `query webhookSubscriptions($topics: [WebhookSubscriptionTopic!]) {
      webhookSubscriptions(first: 10, topics: $topics) {
        nodes { callbackUrl }
      }
    }`,
    { topics: [topic] },
  );
  const alreadyRegistered = existing.webhookSubscriptions.nodes.some(
    (node) => node.callbackUrl === callbackUrl,
  );
  if (alreadyRegistered) return;

  const data = await shopifyGraphQL<{
    webhookSubscriptionCreate: {
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation webhookSubscriptionCreate(
      $topic: WebhookSubscriptionTopic!,
      $webhookSubscription: WebhookSubscriptionInput!
    ) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        userErrors { field message }
      }
    }`,
    {
      topic,
      webhookSubscription: { callbackUrl, format: "JSON" },
    },
  );
  if (data.webhookSubscriptionCreate.userErrors.length) {
    throw new Error(
      data.webhookSubscriptionCreate.userErrors
        .map((error) => error.message)
        .join(", "),
    );
  }
}

// Idempotent: checked (and created if missing) at the start of every
// syncProductsToShopify() run, so both webhook subscriptions self-heal
// without a separate manual setup step - if either is ever deleted from
// the Shopify side, the next scheduled sync re-creates it.
export async function ensureShopifyWebhooksRegistered(
  accessToken: string,
): Promise<void> {
  await ensureWebhookRegistered(
    accessToken,
    "ORDERS_PAID",
    ORDERS_PAID_WEBHOOK_URL,
  );
  await ensureWebhookRegistered(
    accessToken,
    "ORDERS_CREATE",
    ORDERS_CREATE_WEBHOOK_URL,
  );
}
