import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import { getD1 } from "../../../../../lib/store-db";
import { readReturnRequests } from "../route";

export const dynamic = "force-dynamic";

const validStatuses = ["new", "reviewing", "approved", "rejected", "completed"];

function readId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("İade talebi bulunamadı.");
  }
  return id;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const id = readId((await params).id);
    const body = (await request.json()) as {
      status?: unknown;
      adminNote?: unknown;
    };
    const status = String(body.status ?? "");
    if (!validStatuses.includes(status)) {
      return Response.json({ error: "Geçersiz durum değeri." }, { status: 400 });
    }
    const adminNote = String(body.adminNote ?? "").trim().slice(0, 600);

    const result = await getD1()
      .prepare(
        `UPDATE return_requests
         SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(status, adminNote, id)
      .run();
    if (!result.meta.changes) {
      return Response.json({ error: "İade talebi bulunamadı." }, { status: 404 });
    }
    return Response.json({ returnRequests: await readReturnRequests() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "İade talebi güncellenemedi.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const id = readId((await params).id);
    await getD1().prepare("DELETE FROM return_requests WHERE id = ?").bind(id).run();
    return Response.json({ returnRequests: await readReturnRequests() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "İade talebi silinemedi.",
      },
      { status: 400 },
    );
  }
}
