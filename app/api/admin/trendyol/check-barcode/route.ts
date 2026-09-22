import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { getProductByBarcode } from "../../../../../lib/trendyol/client";

export const dynamic = "force-dynamic";

// Teşhis: TEK bir barkodun Trendyol'da (v2, güvenilir) hâlâ var olup
// olmadığını gösterir - "panelden sildim, gerçekten silinmiş mi" sorusuna
// cevap için. Salt okuma, hiçbir şeyi değiştirmez/göndermez.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("barcode");
  if (!barcode) {
    return Response.json({ error: "?barcode= zorunlu." }, { status: 400 });
  }
  try {
    const info = await getProductByBarcode(barcode);
    return Response.json({ foundOnTrendyol: true, ...info });
  } catch (error) {
    return Response.json({
      barcode,
      foundOnTrendyol: false,
      note: "Trendyol bu barkod için hata döndürdü - muhtemelen artık hiç kaydı yok (gerçekten silinmiş olabilir), ama 401/403/429 gibi başka bir hata da olabilir, mesaja bakın.",
      error: error instanceof Error ? error.message : "bilinmeyen hata",
    });
  }
}

export const GET = handle;
export const POST = handle;
