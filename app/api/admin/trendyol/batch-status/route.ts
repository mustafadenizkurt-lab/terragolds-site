import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getBatchRequestResult } from "../../../../../lib/trendyol/client";

export const dynamic = "force-dynamic";

// Teşhis aracı: syncProductsToTrendyol() bir batchRequestId aldığı an
// "başarılı" sayıp D1'e yazıyor, ama Trendyol bu ID'yi kabul (async işleme
// alındı) anlamında dönüyor - ürünlerin gerçekten oluşup oluşmadığı ayrı bir
// sorgu ile (bu servis) kontrol edilmeli. Özellikle özellik (attributes)
// düzeltmesinden ÖNCE gönderilmiş eski partilerin gerçekte kabul olup
// olmadığını doğrulamak için.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const batchRequestId = searchParams.get("batchRequestId");
  if (!batchRequestId) {
    return Response.json({ error: "batchRequestId gerekli." }, { status: 400 });
  }

  try {
    const result = await getBatchRequestResult(batchRequestId);
    const summary = {
      total: result.items?.length ?? 0,
      success: result.items?.filter((item) => item.status === "SUCCESS").length ?? 0,
      failed: result.items?.filter((item) => item.status !== "SUCCESS").length ?? 0,
      sampleFailures: (result.items ?? [])
        .filter((item) => item.status !== "SUCCESS")
        .slice(0, 5),
    };
    return Response.json(summary);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Trendyol isteği başarısız." },
      { status: 400 },
    );
  }
}
