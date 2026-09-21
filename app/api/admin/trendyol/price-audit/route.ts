import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { auditTrendyolPrices } from "../../../../../lib/trendyol/price-audit";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// D1'in "gönderildi" sandığı Trendyol fiyatlarını (trendyol_override_price /
// trendyol_price_synced) Trendyol'un GERÇEKTEN listelediği fiyatla
// karşılaştırır - fiyat güncellemesi Trendyol tarafında sessizce
// reddedilmişse bunu yakalamak için. Hiçbir şeyi değiştirmez, sadece okur.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const result = await auditTrendyolPrices(getD1());
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Kontrol edilemedi." },
      { status: 500 },
    );
  }
}
