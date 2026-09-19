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
async function handle(productIds: number[]) {
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

// Tarayıcı adres çubuğundan tetiklenebilmesi için GET de kabul ediyor:
// ?productIds=5015,5016,...
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const productIds = (searchParams.get("productIds") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return handle(productIds);
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const body = (await request.json().catch(() => ({}))) as { productIds?: number[] };
  const productIds = Array.isArray(body.productIds)
    ? body.productIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  return handle(productIds);
}
