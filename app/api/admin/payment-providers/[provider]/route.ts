import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import {
  listPaymentProvidersForAdmin,
  removePaymentProvider,
  savePaymentProvider,
} from "../../../../../lib/payment-providers";
import { isPaymentProviderId } from "../../../../../lib/payment-types";

export const dynamic = "force-dynamic";

function invalidOriginResponse() {
  return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) return invalidOriginResponse();

  const { provider } = await context.params;
  if (!isPaymentProviderId(provider)) {
    return Response.json(
      { error: "Desteklenmeyen ödeme sağlayıcısı." },
      { status: 404 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const rawCredentials =
      body.credentials && typeof body.credentials === "object"
        ? (body.credentials as Record<string, unknown>)
        : {};
    const credentials = Object.fromEntries(
      Object.entries(rawCredentials).map(([key, value]) => [
        key,
        String(value ?? ""),
      ]),
    );
    await savePaymentProvider({
      provider,
      enabled: Boolean(body.enabled),
      testMode: Boolean(body.testMode),
      isPrimary: Boolean(body.isPrimary),
      credentials,
      updatedBy: admin.id,
    });
    return Response.json({
      providers: await listPaymentProvidersForAdmin(),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ödeme yöntemi kaydedilemedi.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) return invalidOriginResponse();

  const { provider } = await context.params;
  if (!isPaymentProviderId(provider)) {
    return Response.json(
      { error: "Desteklenmeyen ödeme sağlayıcısı." },
      { status: 404 },
    );
  }

  await removePaymentProvider(provider, admin.id);
  return Response.json({
    providers: await listPaymentProvidersForAdmin(),
  });
}
