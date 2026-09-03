import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import {
  deleteCustomOrderGalleryItem,
  ensureCustomOrderGalleryTable,
  readCustomOrderGallery,
  updateCustomOrderGalleryItem,
} from "../../../../../lib/custom-order-gallery";

export const dynamic = "force-dynamic";

function readId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Galeri öğesi bulunamadı.");
  }
  return id;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  await ensureCustomOrderGalleryTable();
  try {
    const id = readId((await params).id);
    const body = (await request.json()) as Record<string, unknown>;
    const title = String(body.title ?? "").trim().slice(0, 120);
    const description = String(body.description ?? "").trim().slice(0, 400);
    await updateCustomOrderGalleryItem(id, { title, description });
    return Response.json({ items: await readCustomOrderGallery() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Galeri öğesi güncellenemedi.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  await ensureCustomOrderGalleryTable();
  try {
    const id = readId((await params).id);
    await deleteCustomOrderGalleryItem(id);
    return Response.json({ items: await readCustomOrderGallery() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Galeri öğesi silinemedi.",
      },
      { status: 400 },
    );
  }
}
