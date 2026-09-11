import { listEnabledPaymentProviders } from "../../../../lib/payment-providers";
import { readSettings } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Not a real payment-providers.ts gateway (no credentials, no callback) -
// see CheckoutPaymentMethod's comment in lib/payment-types.ts - so it's
// appended here rather than modeled as one.
const codMethod = {
  id: "cod" as const,
  name: "Kapıda Ödeme",
  shortDescription: "Siparişinizi teslim alırken nakit veya kartla ödeyin.",
  enabled: true,
  configured: true,
  testMode: false,
  isPrimary: false,
  supportsTestMode: false,
};

export async function GET() {
  try {
    const [providers, settings] = await Promise.all([
      listEnabledPaymentProviders(),
      readSettings(),
    ]);
    const methods: Array<
      (typeof providers)[number] | typeof codMethod
    > = providers.filter((method) => method.id === "paytr");
    if (settings.codEnabled === "true") methods.push(codMethod);
    return Response.json(
      { methods },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { methods: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
