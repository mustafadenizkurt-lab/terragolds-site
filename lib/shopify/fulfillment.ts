import { getShopifyAccessToken } from "./auth";
import { shopifyGraphQL } from "./client";

// One-directional by design (per the store owner's explicit choice):
// Terragolds admin is the only place shipping status is edited. This just
// reports that decision to Shopify so the customer sees the right status
// there too - it never reads a status change back from Shopify.
export async function fulfillShopifyOrder(
  shopifyOrderId: string,
  carrier: string,
  trackingNumber: string,
): Promise<void> {
  const accessToken = await getShopifyAccessToken();
  const orderGid = `gid://shopify/Order/${shopifyOrderId}`;

  const data = await shopifyGraphQL<{
    order: {
      fulfillmentOrders: { nodes: { id: string; status: string }[] };
    } | null;
  }>(
    accessToken,
    `query order($id: ID!) {
      order(id: $id) {
        fulfillmentOrders(first: 10) {
          nodes { id status }
        }
      }
    }`,
    { id: orderGid },
  );

  const openFulfillmentOrders = (
    data.order?.fulfillmentOrders.nodes ?? []
  ).filter((node) => node.status === "OPEN");
  if (openFulfillmentOrders.length === 0) {
    // Already fulfilled on the Shopify side, or the order doesn't exist
    // there (shouldn't happen) - nothing left to do.
    return;
  }

  const result = await shopifyGraphQL<{
    fulfillmentCreateV2: {
      fulfillment: { id: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
      fulfillmentCreateV2(fulfillment: $fulfillment) {
        fulfillment { id }
        userErrors { field message }
      }
    }`,
    {
      fulfillment: {
        lineItemsByFulfillmentOrder: openFulfillmentOrders.map((node) => ({
          fulfillmentOrderId: node.id,
        })),
        trackingInfo: {
          number: trackingNumber,
          company: carrier,
        },
        notifyCustomer: true,
      },
    },
  );
  if (result.fulfillmentCreateV2.userErrors.length) {
    throw new Error(
      result.fulfillmentCreateV2.userErrors
        .map((error) => error.message)
        .join(", "),
    );
  }
}
