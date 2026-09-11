import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import { reverseEarnedPoints } from "../../../../../lib/loyalty";
import { reverseCommissionForOrder } from "../../../../../lib/partner-referral";
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

    const db = getD1();
    const result = await db
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

    // A completed return means the refund actually went through - claw back
    // any commission already earned on that order. order_number is free
    // text the customer typed on the return form (no real FK to orders), so
    // this is a best-effort, always-safe no-op if it doesn't match a real
    // order id.
    if (status === "completed") {
      const returnRequest = await db
        .prepare("SELECT order_number AS orderNumber FROM return_requests WHERE id = ?")
        .bind(id)
        .first<{ orderNumber: string }>();
      if (returnRequest?.orderNumber) {
        const orderId = returnRequest.orderNumber.trim();
        try {
          await reverseCommissionForOrder(db, orderId);
        } catch {
          // Never block the return-request update itself over this.
        }
        try {
          await reverseEarnedPoints(db, orderId);
        } catch {
          // Same - a loyalty bookkeeping hiccup shouldn't block the return update.
        }
      }
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
