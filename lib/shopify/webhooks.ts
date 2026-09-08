import { shopifyGraphQL, SITE_ORIGIN } from "./client";

export const ORDERS_PAID_WEBHOOK_URL = `${SITE_ORIGIN}/api/webhooks/shopify/orders-paid`;

// Idempotent: checked (and created if missing) at the start of every
// syncProductsToShopify() run, so the webhook subscription self-heals
// without a separate manual setup step - if it's ever deleted from the
// Shopify side, the next scheduled sync re-creates it.
export async function ensureOrdersPaidWebhookRegistered(
  accessToken: string,
): Promise<void> {
  const existing = await shopifyGraphQL<{
    webhookSubscriptions: { nodes: { callbackUrl: string }[] };
  }>(
    accessToken,
    `query { webhookSubscriptions(first: 10, topics: [ORDERS_PAID]) {
      nodes { callbackUrl }
    } }`,
    {},
  );
  const alreadyRegistered = existing.webhookSubscriptions.nodes.some(
    (node) => node.callbackUrl === ORDERS_PAID_WEBHOOK_URL,
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
      topic: "ORDERS_PAID",
      webhookSubscription: {
        callbackUrl: ORDERS_PAID_WEBHOOK_URL,
        format: "JSON",
      },
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
