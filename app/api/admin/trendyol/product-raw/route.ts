import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getProductsRaw } from "../../../../../lib/trendyol/client";

export const dynamic = "force-dynamic";

// Teşhis: Trendyol'da onaylı bir ürünün TAM içeriğini (görsel URL'leri
// dahil) geri okuyup okuyamadığımızı test ediyor - elle düzeltilmiş
// görseli Trendyol'dan D1'e geri çekebilmek için. ?barcode= zorunlu,
// ?approved=true/false opsiyonel. Ham yanıtı olduğu gibi döndürüyor.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("barcode") ?? undefined;
  const approvedParam = searchParams.get("approved");
  const approved = approvedParam === null ? undefined : approvedParam === "true";
  try {
    const result = await getProductsRaw({ barcode, approved, size: 5 });
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "İstek başarısız." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
