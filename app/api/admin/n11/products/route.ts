import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getMyProductsRaw } from "../../../../../lib/n11/client";

export const dynamic = "force-dynamic";

// GET /ms/product-query'nin ham yanıtını döner - şu an sadece teşhis amaçlı
// (curl/admin panel dışı kullanım için), D1 tek gerçek kaynak olduğundan bu
// uç noktanın sonucu hiçbir yerde D1'e geri yazılmıyor.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  try {
    const result = await getMyProductsRaw({
      id: searchParams.get("id") ? Number(searchParams.get("id")) : undefined,
      productMainId: searchParams.get("productMainId") ?? undefined,
      stockCode: searchParams.get("stockCode") ?? undefined,
      saleStatus: searchParams.get("saleStatus") ?? undefined,
      productStatus: searchParams.get("productStatus") ?? undefined,
      brandName: searchParams.get("brandName") ?? undefined,
      categoryIds: searchParams.get("categoryIds") ?? undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      size: searchParams.get("size") ? Number(searchParams.get("size")) : undefined,
    });
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "N11 ürünleri alınamadı." },
      { status: 400 },
    );
  }
}
