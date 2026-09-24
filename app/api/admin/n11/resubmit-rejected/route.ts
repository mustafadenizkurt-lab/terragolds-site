import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { resubmitRejectedToN11 } from "../../../../../lib/n11/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// CatalogRejected ürünleri güncel kurallarla product-update ile yeniden
// göndermeyi dener. NOT: canlıda denendi (BKO5903) - N11 reddedilmiş bir
// listelemede product-update'i "katalog tarafından reddedildi" diyerek geri
// çeviriyor ve kategoriyi değiştirmiyor, yani şu an etkisiz. Yine de N11'de
// veri değiştirdiği için SADECE POST (GET ile adres çubuğu/bağlantı üzerinden
// tetiklenmesin diye); varsayılan limit 1.
export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const body = (await request.json().catch(() => ({}))) as {
    limit?: number;
    stockCode?: string;
  };
  try {
    return Response.json(
      await resubmitRejectedToN11(getD1(), { limit: body.limit, stockCode: body.stockCode }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "N11 yeniden gönderim başarısız." },
      { status: 500 },
    );
  }
}
