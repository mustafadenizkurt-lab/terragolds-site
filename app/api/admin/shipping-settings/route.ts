import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import {
  getShippingTrackingSettings,
  saveShippingTrackingSettings,
} from "../../../../lib/shipping-tracking-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json(
    { settings: await getShippingTrackingSettings() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const settings = await saveShippingTrackingSettings({
      manualDeliveryEnabled: Boolean(body.manualDeliveryEnabled),
      automaticTrackingEnabled: Boolean(body.automaticTrackingEnabled),
      providerName: String(body.providerName ?? ""),
      apiBaseUrl: String(body.apiBaseUrl ?? ""),
      apiKey: String(body.apiKey ?? ""),
      accountCode: String(body.accountCode ?? ""),
      updatedBy: admin.id,
    });
    return Response.json({ settings });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Kargo takip ayarları kaydedilemedi.",
      },
      { status: 400 },
    );
  }
}
