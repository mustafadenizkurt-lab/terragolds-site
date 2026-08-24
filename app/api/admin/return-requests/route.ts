import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export type ReturnRequestAdminRow = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  productDescription: string;
  trackingNumber: string;
  reason: string;
  iban: string;
  status: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

export async function readReturnRequests() {
  const rows = await getD1()
    .prepare(
      `SELECT id, full_name, email, phone, order_number, product_description,
              tracking_number, reason, iban, status, admin_note,
              created_at, updated_at
       FROM return_requests ORDER BY created_at DESC, id DESC`,
    )
    .all<{
      id: number;
      full_name: string;
      email: string;
      phone: string;
      order_number: string;
      product_description: string;
      tracking_number: string;
      reason: string;
      iban: string;
      status: string;
      admin_note: string;
      created_at: string;
      updated_at: string;
    }>();
  return rows.results.map(
    (row) =>
      ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        orderNumber: row.order_number,
        productDescription: row.product_description,
        trackingNumber: row.tracking_number,
        reason: row.reason,
        iban: row.iban,
        status: row.status,
        adminNote: row.admin_note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }) satisfies ReturnRequestAdminRow,
  );
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json({ returnRequests: await readReturnRequests() });
}
