// Thin wrappers around GA4/Meta Pixel globals — both are only defined when
// an ID is configured in admin settings (see app/layout.tsx), so every call
// here is a safe no-op on a store that hasn't set up tracking yet.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackAddToCart(item: {
  id: number;
  name: string;
  price: number;
  quantity: number;
}) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "add_to_cart", {
    currency: "TRY",
    value: item.price * item.quantity,
    items: [
      {
        item_id: String(item.id),
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      },
    ],
  });
  window.fbq?.("track", "AddToCart", {
    content_ids: [String(item.id)],
    content_name: item.name,
    currency: "TRY",
    value: item.price * item.quantity,
  });
}

export function trackPurchase(order: {
  id: string;
  value: number;
  currency?: string;
}) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "purchase", {
    transaction_id: order.id,
    currency: order.currency ?? "TRY",
    value: order.value,
  });
  window.fbq?.("track", "Purchase", {
    currency: order.currency ?? "TRY",
    value: order.value,
  });
}
