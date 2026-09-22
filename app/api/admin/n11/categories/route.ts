import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  getCategories,
  getCategoriesRaw,
  flattenN11Categories,
} from "../../../../../lib/n11/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? undefined;

  // Ham teşhis modu: N11'in gerçek yanıt zarfını (categories anahtarı,
  // id/name alan adları) olduğu gibi görmek için - kategori eşlemesi ilk
  // kurulurken alan adlarının varsayımlarımızla (client.ts) eşleştiğini
  // doğrulamak amacıyla.
  if (searchParams.get("raw") === "1") {
    try {
      return Response.json(await getCategoriesRaw());
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "N11 kategorileri alınamadı." },
        { status: 400 },
      );
    }
  }

  try {
    const categories = await getCategories(name);
    const flat = flattenN11Categories(categories).slice(0, 50);
    return Response.json({ categories: flat });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "N11 kategorileri alınamadı.",
      },
      { status: 400 },
    );
  }
}
