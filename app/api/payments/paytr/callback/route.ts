import {
  markOrderFailed,
  markOrderPaid,
  readPaymentOrder,
} from "../../../../../lib/order-payment";
import { getPaymentProvider } from "../../../../../lib/payment-providers";
import {
  constantTimeEquals,
  hmacSha256,
} from "../../../../../lib/payment-signatures";

export const dynamic = "force-dynamic";

function paytrResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return paytrResponse("bad request", 400);
  }
  const orderId = String(form.get("merchant_oid") ?? "").trim();
  const status = String(form.get("status") ?? "").trim();
  const totalAmount = String(form.get("total_amount") ?? "").trim();
  const paymentAmount = String(form.get("payment_amount") ?? "").trim();
  const hash = String(form.get("hash") ?? "").trim();
  if (!orderId || !status || !totalAmount || !hash) {
    return paytrResponse("bad request", 400);
  }

  try {
    const provider = await getPaymentProvider("paytr", false);
    const expected = await hmacSha256(
      `${orderId}${provider.credentials.merchantSalt}${status}${totalAmount}`,
      provider.credentials.merchantKey,
      "base64",
    );
    if (!constantTimeEquals(expected, hash)) {
      return paytrResponse("PAYTR notification failed: bad hash", 400);
    }

    const order = await readPaymentOrder(orderId);
    if (!order || order.payment_provider !== "paytr") {
      return paytrResponse("order not found", 404);
    }
    if (order.status === "paid") return paytrResponse("OK");

    if (status !== "success") {
      await markOrderFailed(orderId, "paytr", `failed-${orderId}`);
      return paytrResponse("OK");
    }
    if (
      !paymentAmount ||
      !Number.isInteger(Number(paymentAmount)) ||
      Number(paymentAmount) !== order.total_amount
    ) {
      return paytrResponse("payment amount mismatch", 400);
    }

    await markOrderPaid({
      orderId,
      provider: "paytr",
      paymentId: `paytr-${orderId}`,
    });
    return paytrResponse("OK");
  } catch {
    return paytrResponse("callback error", 500);
  }
}
