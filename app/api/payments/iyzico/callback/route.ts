import {
  IYZICO_RETRIEVE_PATH,
  iyzicoRequest,
  normalizeIyzicoPrice,
  verifyIyzicoResponseSignature,
} from "../../../../../lib/payment-gateways";
import {
  markOrderFailed,
  markOrderPaid,
  readPaymentOrderByReference,
} from "../../../../../lib/order-payment";
import { getPaymentProvider } from "../../../../../lib/payment-providers";

export const dynamic = "force-dynamic";

function resultRedirect(
  request: Request,
  status: "success" | "failed" | "pending",
  orderId = "",
) {
  const target = new URL("/payment/result", request.url);
  target.searchParams.set("status", status);
  if (orderId) target.searchParams.set("orderId", orderId);
  return Response.redirect(target, 303);
}

export async function POST(request: Request) {
  let token = "";
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { token?: string };
      token = String(body.token ?? "").trim();
    } else {
      token = String((await request.formData()).get("token") ?? "").trim();
    }
  } catch {
    return resultRedirect(request, "failed");
  }
  if (!token || token.length > 300) return resultRedirect(request, "failed");

  const order = await readPaymentOrderByReference("iyzico", token);
  if (!order) return resultRedirect(request, "failed");
  if (order.status === "paid") {
    return resultRedirect(request, "success", order.id);
  }

  try {
    const provider = await getPaymentProvider("iyzico", false);
    const result = await iyzicoRequest<{
      paymentStatus?: string;
      paymentId?: string;
      currency?: string;
      basketId?: string;
      conversationId?: string;
      paidPrice?: string | number;
      price?: string | number;
      token?: string;
      fraudStatus?: number;
      signature?: string;
    }>(provider, IYZICO_RETRIEVE_PATH, {
      locale: "tr",
      conversationId: order.id,
      token,
    });
    const signatureIsValid = await verifyIyzicoResponseSignature(
      [
        result.paymentStatus,
        result.paymentId,
        result.currency,
        result.basketId,
        result.conversationId,
        normalizeIyzicoPrice(result.paidPrice),
        normalizeIyzicoPrice(result.price),
        result.token,
      ],
      result.signature,
      provider.credentials.secretKey,
    );
    const amountMatches =
      Math.round(Number(result.price) * 100) === order.total_amount;
    const orderMatches =
      result.basketId === order.id &&
      result.conversationId === order.id &&
      result.token === token;
    if (!signatureIsValid || !amountMatches || !orderMatches) {
      return resultRedirect(request, "failed", order.id);
    }
    if (result.paymentStatus !== "SUCCESS" || !result.paymentId) {
      await markOrderFailed(order.id, "iyzico", result.paymentId ?? "");
      return resultRedirect(request, "failed", order.id);
    }
    if (result.fraudStatus !== 1) {
      return resultRedirect(request, "pending", order.id);
    }

    await markOrderPaid({
      orderId: order.id,
      provider: "iyzico",
      paymentId: result.paymentId,
    });
    return resultRedirect(request, "success", order.id);
  } catch {
    return resultRedirect(request, "failed", order.id);
  }
}
