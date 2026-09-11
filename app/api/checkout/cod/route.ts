import { createCheckoutOrder } from "../../../../lib/checkout-order";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import { markOrderPaid } from "../../../../lib/order-payment";
import { readSettings } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const settings = await readSettings();
    if (settings.codEnabled !== "true") {
      return Response.json(
        { error: "Kapıda ödeme şu anda kullanılamıyor." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    // orders.payment_provider has a DB-level CHECK constraint limited to
    // the three real gateways, so "paytr" is stored as a technical
    // placeholder here - is_cod (set via the isCod option) is the actual,
    // authoritative flag every admin/display surface reads instead.
    const order = await createCheckoutOrder(request, body, "paytr", {
      isCod: true,
    });
    // No gateway involved - the order is confirmed the moment it's placed
    // so it enters the normal fulfillment queue immediately; the cash
    // itself is only actually collected by the courier at delivery.
    await markOrderPaid({
      orderId: order.id,
      provider: "paytr",
      paymentId: "cod",
    });

    const resultUrl = new URL("/payment/result", request.url);
    resultUrl.searchParams.set("status", "cod");
    resultUrl.searchParams.set("orderId", order.id);
    return Response.json(
      { orderId: order.id, redirectUrl: resultUrl.toString() },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Sipariş oluşturulamadı.",
      },
      { status: 400 },
    );
  }
}
