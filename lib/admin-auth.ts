import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerFromRequest } from "./customer-auth";
import { getAdminEmailAllowlist, getD1 } from "./store-db";

export async function getAuthorizedAdmin(request?: Request) {
  const authRequest =
    request ??
    new Request("https://terragolds.local/admin", {
      headers: await headers(),
    });
  const customer = await getCustomerFromRequest(authRequest);
  if (!customer) return null;

  const allowlist = getAdminEmailAllowlist();
  const databaseRole = await getD1()
    .prepare("SELECT role FROM users WHERE id = ? LIMIT 1")
    .bind(customer.id)
    .first<{ role: string }>();
  const emailIsAllowed = allowlist.includes(
    customer.email.toLocaleLowerCase("tr-TR"),
  );
  if (databaseRole?.role !== "admin" && !emailIsAllowed) {
    return null;
  }

  return {
    id: customer.id,
    displayName:
      `${customer.firstName} ${customer.lastName}`.trim() || customer.email,
    email: customer.email,
  };
}

export async function requireAuthorizedAdmin(returnTo = "/admin") {
  const user = await getAuthorizedAdmin();
  if (user) return user;

  redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
}

export function unauthorizedAdminResponse() {
  return Response.json(
    { error: "Bu işlem için yönetici girişi gerekli." },
    { status: 401 },
  );
}
