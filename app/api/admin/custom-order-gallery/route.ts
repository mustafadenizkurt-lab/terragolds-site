import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import {
  createCustomOrderGalleryItem,
  ensureCustomOrderGalleryTable,
  readCustomOrderGallery,
} from "../../../../lib/custom-order-gallery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  await ensureCustomOrderGalleryTable();
  return Response.json(
    { items: await readCustomOrderGallery() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  await ensureCustomOrderGalleryTable();
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const imageUrl = String(body.imageUrl ?? "").trim();
    if (!imageUrl) {
      return Response.json(
        { error: "Önce bir görsel yükleyin." },
        { status: 400 },
      );
    }
    const title = String(body.title ?? "").trim().slice(0, 120);
    const description = String(body.description ?? "").trim().slice(0, 400);
    await createCustomOrderGalleryItem({ imageUrl, title, description });
    return Response.json({ items: await readCustomOrderGallery() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Galeri öğesi eklenemedi.",
      },
      { status: 400 },
    );
  }
}
