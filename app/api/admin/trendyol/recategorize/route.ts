import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { updateProductsCategoryOnTrendyol } from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Tek seferlik düzeltme aracı: yanlış categoryId ile Trendyol'a gönderilmiş
// ürünleri (aynı barkodla) PUT/update ile doğru kategoriye taşır. Normal
// createProduct() akışı zaten var olan bir barkod için "Aynı barkodlu bir
// ürününüz bulunduğundan yeni ürün oluşturulamaz" hatası veriyor.
export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const body = (await request.json().catch(() => ({}))) as { productIds?: number[] };
  const productIds = Array.isArray(body.productIds)
    ? body.productIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  if (productIds.length === 0) {
    return Response.json({ error: "Geçerli productIds listesi gerekli." }, { status: 400 });
  }

  try {
    const result = await updateProductsCategoryOnTrendyol(getD1(), productIds);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Trendyol isteği başarısız." },
      { status: 400 },
    );
  }
}
