import {
  customerUnauthorizedResponse,
  getCustomerFromRequest,
  isSameOriginRequest,
} from "../../../../../lib/customer-auth";
import { createEmailVerification } from "../../../../../lib/email-verification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const customer = await getCustomerFromRequest(request);
  if (!customer) return customerUnauthorizedResponse();
  if (customer.emailVerifiedAt) {
    return Response.json({ ok: true, alreadyVerified: true });
  }

  try {
    const verification = await createEmailVerification({
      email: customer.email,
      userId: customer.id,
      kind: "account",
      origin: new URL(request.url).origin,
    });
    return Response.json({ ok: true, verification });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Doğrulama e-postası gönderilemedi.",
      },
      { status: 400 },
    );
  }
}
