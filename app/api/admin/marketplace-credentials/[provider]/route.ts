import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import {
  isMarketplaceId,
  listMarketplaceCredentialsForAdmin,
  removeMarketplaceCredential,
  saveMarketplaceCredential,
} from "../../../../../lib/marketplace-credentials";

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
  if (!isMarketplaceId(provider)) {
    return Response.json(
      { error: "Desteklenmeyen pazaryeri." },
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
    await saveMarketplaceCredential({
      provider,
      enabled: Boolean(body.enabled),
      credentials,
      updatedBy: admin.id,
    });
    return Response.json({
      providers: await listMarketplaceCredentialsForAdmin(),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pazaryeri bilgileri kaydedilemedi.",
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
  if (!isMarketplaceId(provider)) {
    return Response.json(
      { error: "Desteklenmeyen pazaryeri." },
      { status: 404 },
    );
  }

  await removeMarketplaceCredential(provider, admin.id);
  return Response.json({
    providers: await listMarketplaceCredentialsForAdmin(),
  });
}
