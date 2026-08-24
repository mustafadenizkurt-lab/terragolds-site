import {
  markOrderFailed,
  markOrderPaid,
  readPaymentOrder,
} from "./order-payment";
import { getPaymentProvider } from "./payment-providers";
import { constantTimeEquals, hmacSha256 } from "./payment-signatures";

type ShopierCallbackPayload = {
  platform_order_id?: string;
  API_key?: string;
  status?: string;
  payment_id?: string;
  random_nr?: string;
  signature?: string;
};

async function readCallbackPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as ShopierCallbackPayload;
  }
  const formData = await request.formData();
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  ) as ShopierCallbackPayload;
}

function shopierResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handleShopierCallback(request: Request) {
  let payload: ShopierCallbackPayload;
  try {
    payload = await readCallbackPayload(request);
  } catch {
    return shopierResponse("bad request", 400);
  }

  const orderId = String(payload.platform_order_id ?? "").trim();
  const apiKey = String(payload.API_key ?? "").trim();
  const status = String(payload.status ?? "").trim();
  const paymentId = String(payload.payment_id ?? "").trim();
  const randomNr = String(payload.random_nr ?? "").trim();
  const signature = String(payload.signature ?? "").trim();
  if (!orderId || !apiKey || !status || !paymentId || !randomNr || !signature) {
    return shopierResponse("bad request", 400);
  }

  try {
    const provider = await getPaymentProvider("shopier", false);
    const expectedSignature = await hmacSha256(
      `${randomNr}${orderId}`,
      provider.credentials.secretKey,
      "base64",
    );
    if (
      !constantTimeEquals(expectedSignature, signature) ||
      !constantTimeEquals(provider.credentials.apiKey, apiKey)
    ) {
      return shopierResponse("invalid signature", 400);
    }

    const order = await readPaymentOrder(orderId);
    if (
      !order ||
      order.payment_provider !== "shopier" ||
      !constantTimeEquals(order.shopier_random_nr, randomNr)
    ) {
      return shopierResponse("order not found", 404);
    }
    if (order.status === "paid") {
      if (order.payment_id && !constantTimeEquals(order.payment_id, paymentId)) {
        return shopierResponse("payment conflict", 409);
      }
      return shopierResponse("success");
    }

    if (status !== "success") {
      await markOrderFailed(orderId, "shopier", paymentId);
      return shopierResponse("success");
    }
    await markOrderPaid({ orderId, provider: "shopier", paymentId });
    return shopierResponse("success");
  } catch {
    return shopierResponse("callback error", 500);
  }
}
