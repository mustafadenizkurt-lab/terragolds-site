import { listEnabledPaymentProviders } from "../../../../lib/payment-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const methods = await listEnabledPaymentProviders();
    return Response.json(
      { methods: methods.filter((method) => method.id === "paytr") },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { methods: [] },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
