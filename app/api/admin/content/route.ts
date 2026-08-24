import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import {
  readAdminSiteContent,
  saveSiteContent,
} from "../../../../lib/site-content";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json(
    { content: await readAdminSiteContent() },
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
    const action = body.action === "publish" ? "publish" : "draft";
    const values =
      body.values && typeof body.values === "object"
        ? (body.values as Record<string, unknown>)
        : {};
    const content = await saveSiteContent({
      values,
      action,
      updatedBy: admin.id,
    });
    return Response.json({ content });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "İçerik kaydedilemedi.",
      },
      { status: 400 },
    );
  }
}
