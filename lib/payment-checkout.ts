import { createCheckoutOrder } from "./checkout-order";
import { isSameOriginRequest } from "./customer-auth";
import { initializePayment } from "./payment-gateways";
import { getPaymentProvider } from "./payment-providers";
import {
  isPaymentProviderId,
  type PaymentProviderId,
} from "./payment-types";

export async function startPaymentCheckout(
  request: Request,
  forcedProvider?: PaymentProviderId,
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const provider = forcedProvider ?? body.provider;
    if (!isPaymentProviderId(provider)) {
      return Response.json(
        { error: "Geçerli bir ödeme yöntemi seçin." },
        { status: 400 },
      );
    }

    await getPaymentProvider(provider);
    const order = await createCheckoutOrder(request, body, provider);
    const result = await initializePayment(provider, request, order);
    return Response.json(result, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Ödeme başlatılamadı.",
      },
      { status: 400 },
    );
  }
}
