export const paymentProviderIds = ["shopier", "paytr", "iyzico"] as const;

export type PaymentProviderId = (typeof paymentProviderIds)[number];

/**
 * Cash on delivery isn't a credential-configured gateway like the ids
 * above (no provider account, no callback, no initializePayment step), so
 * it deliberately isn't part of PaymentProviderId - it would force
 * payment-providers.ts's credential/admin-UI plumbing to handle a
 * provider with zero fields. It's also not stored as
 * orders.payment_provider - that column has a DB-level CHECK constraint
 * limited to the three real ids, so a COD order stores 'paytr' there as a
 * placeholder and is distinguished by orders.is_cod instead (see
 * lib/checkout-order.ts). This wider type exists only for the
 * client-facing checkout method list/selection, which is a purely
 * client + route-selection concern.
 */
export type CheckoutPaymentMethod = PaymentProviderId | "cod";

export type PaymentProviderSummary = {
  id: PaymentProviderId;
  name: string;
  shortDescription: string;
  enabled: boolean;
  configured: boolean;
  testMode: boolean;
  isPrimary: boolean;
  credentialHint: string;
  supportsTestMode: boolean;
  fields: Array<{
    key: string;
    label: string;
    secret: boolean;
    placeholder: string;
    required: boolean;
  }>;
};

export function isPaymentProviderId(
  value: unknown,
): value is PaymentProviderId {
  return (
    typeof value === "string" &&
    paymentProviderIds.includes(value as PaymentProviderId)
  );
}
