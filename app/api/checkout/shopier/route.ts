import { startPaymentCheckout } from "../../../../lib/payment-checkout";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return startPaymentCheckout(request, "shopier");
}
