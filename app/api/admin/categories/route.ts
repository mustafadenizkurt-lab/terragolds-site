import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import {
  parseCategoryInput,
  readProductCategories,
} from "../../../../lib/product-categories";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json(
    { categories: await readProductCategories(true) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  try {
    const category = parseCategoryInput(await request.json());
    await getD1()
      .prepare(
        `INSERT INTO product_categories
          (name, description, active, sort_order, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      )
      .bind(
        category.name,
        category.description,
        category.active ? 1 : 0,
        category.sortOrder,
      )
      .run();
    return Response.json(
      { categories: await readProductCategories(true) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.toLowerCase().includes("unique")
          ? "Bu kategori zaten bulunuyor."
          : message || "Kategori oluşturulamadı.",
      },
      { status: 400 },
    );
  }
}
