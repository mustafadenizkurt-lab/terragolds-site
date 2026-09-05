import type { PaymentProviderId } from "./payment-types";
import type { Product } from "./store-data";

export type SystemHealthCheck = {
  id: string;
  label: string;
  status: "passed" | "warning" | "failed";
  summary: string;
  action?: string;
};

export type SystemTestStep = {
  id: string;
  label: string;
  status: "passed" | "warning" | "failed" | "skipped";
  detail: string;
};

export type SystemTestRun = {
  id: number;
  testId: string;
  kind: "purchase" | "email";
  scenario: string;
  status: "passed" | "failed";
  summary: string;
  details: {
    steps?: SystemTestStep[];
    quote?: {
      subtotalAmount: number;
      discountAmount: number;
      vatAmount: number;
      shippingAmount: number;
      totalAmount: number;
      discountCode: string | null;
    };
    productName?: string;
    providerName?: string;
    recipient?: string;
  };
  createdAt: string;
};

export type SystemTestProvider = {
  id: PaymentProviderId;
  name: string;
  enabled: boolean;
  configured: boolean;
  testMode: boolean;
  isPrimary: boolean;
};

export type SystemTestDashboard = {
  checks: SystemHealthCheck[];
  products: Product[];
  providers: SystemTestProvider[];
  runs: SystemTestRun[];
};
