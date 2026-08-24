export const paymentProviderIds = ["shopier", "paytr", "iyzico"] as const;

export type PaymentProviderId = (typeof paymentProviderIds)[number];

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
