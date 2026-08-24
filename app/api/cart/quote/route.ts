import {
  calculateCartQuote,
  CartUnavailableProductError,
} from "../../../../lib/cart-pricing";
import { isSameOriginRequest } from "../../../../lib/customer-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const quote = await calculateCartQuote(body.items, body.discountCode);
    return Response.json({
      subtotalAmount: quote.subtotalAmount,
      discountAmount: quote.discountAmount,
      shippingAmount: quote.shippingAmount,
      shippingFee: quote.shippingFee,
      freeShipping: quote.freeShipping,
      freeShippingThreshold: quote.freeShippingThreshold,
      totalAmount: quote.totalAmount,
      discountCode: quote.discountCode,
      discountDescription: quote.discountDescription,
    });
  } catch (error) {
    if (error instanceof CartUnavailableProductError) {
      return Response.json(
        {
          error: error.message,
          code: "UNAVAILABLE_PRODUCTS",
          productIds: error.productIds,
        },
        { status: 409 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Sepet hesaplanamadı.",
      },
      { status: 400 },
    );
  }
}
