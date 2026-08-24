import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { normalizeCustomerName } from "../../../../lib/customer-name";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

type CustomerRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  email_verified_at: string | null;
  created_at: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
};

const roles = new Set(["customer", "admin"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const customers = await getD1()
      .prepare(
        `SELECT
            users.id,
            users.first_name,
            users.last_name,
            users.email,
            users.phone,
            users.role,
            users.email_verified_at,
            users.created_at,
            COUNT(orders.id) AS total_orders,
            COALESCE(SUM(CASE
              WHEN orders.status IN ('paid', 'shipped', 'delivered')
              THEN orders.total_amount
              ELSE 0
            END), 0) AS total_spent,
            MAX(orders.created_at) AS last_order_at
          FROM users
          LEFT JOIN orders ON orders.user_id = users.id
          GROUP BY users.id
          ORDER BY datetime(users.created_at) DESC
          LIMIT 300`,
      )
      .all<CustomerRow>();

    return Response.json({ customers: customers.results });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Müşteri listesi alınamadı.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();

  try {
    const body = (await request.json()) as {
      id?: unknown;
      firstName?: unknown;
      lastName?: unknown;
      email?: unknown;
      phone?: unknown;
      role?: unknown;
      emailVerified?: unknown;
    };
    const id = Number(body.id);
    const requestedRole =
      body.role === undefined ? undefined : String(body.role ?? "");

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      (requestedRole !== undefined && !roles.has(requestedRole))
    ) {
      return Response.json(
        { error: "Geçerli bir müşteri seçin." },
        { status: 400 },
      );
    }

    if (id === admin.id && requestedRole !== undefined && requestedRole !== "admin") {
      return Response.json(
        { error: "Kendi yönetici yetkinizi buradan kaldıramazsınız." },
        { status: 400 },
      );
    }

    const current = await getD1()
      .prepare(
        `SELECT first_name, last_name, email, phone, role, email_verified_at
         FROM users WHERE id = ? LIMIT 1`,
      )
      .bind(id)
      .first<{
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        role: string;
        email_verified_at: string | null;
      }>();

    if (!current) {
      return Response.json(
        { error: "Müşteri bulunamadı." },
        { status: 404 },
      );
    }

    const firstName =
      body.firstName === undefined
        ? current.first_name
        : normalizeCustomerName(body.firstName);
    const lastName =
      body.lastName === undefined
        ? current.last_name
        : normalizeCustomerName(body.lastName);
    const email =
      body.email === undefined
        ? current.email
        : String(body.email ?? "").trim().toLocaleLowerCase("tr-TR");
    const phone =
      body.phone === undefined
        ? current.phone
        : String(body.phone ?? "").trim().slice(0, 30);
    const role = requestedRole ?? current.role;
    const emailVerifiedAt =
      body.emailVerified === undefined
        ? current.email_verified_at
        : body.emailVerified
          ? current.email_verified_at ?? new Date().toISOString()
          : null;

    if (!firstName || !lastName) {
      return Response.json(
        { error: "Ad ve soyad zorunludur." },
        { status: 400 },
      );
    }
    if (!emailPattern.test(email)) {
      return Response.json(
        { error: "Geçerli bir e-posta adresi girin." },
        { status: 400 },
      );
    }

    const shouldRefreshSessions =
      role !== current.role ||
      email !== current.email ||
      emailVerifiedAt !== current.email_verified_at;

    await getD1()
      .prepare(
        `UPDATE users
          SET first_name = ?,
              last_name = ?,
              email = ?,
              phone = ?,
              role = ?,
              email_verified_at = ?,
              session_version = session_version + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
      )
      .bind(
        firstName,
        lastName,
        email,
        phone,
        role,
        emailVerifiedAt,
        shouldRefreshSessions ? 1 : 0,
        id,
      )
      .run();

    return Response.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLocaleLowerCase("tr-TR").includes("unique")
    ) {
      return Response.json(
        { error: "Bu e-posta adresi başka bir hesapta kullanılıyor." },
        { status: 409 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Müşteri güncellenemedi.",
      },
      { status: 500 },
    );
  }
}
