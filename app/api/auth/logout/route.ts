import {
  clearCustomerSessionCookie,
  isSameOriginRequest,
} from "../../../../lib/customer-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  return clearCustomerSessionCookie(Response.json({ ok: true }));
}
