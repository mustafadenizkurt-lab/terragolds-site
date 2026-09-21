import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { auditAndFixTrendyolPrices } from "../../../../../lib/trendyol/price-audit";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// price-audit'in salt okunur hâlinden farklı olarak, bulduğu (gerçekten
// aktif/pozitif fiyatlı) uyuşmazlıkları hemen düzeltip Trendyol'a yeniden
// gönderir - 6 saatlik cron'u beklemeden manuel tetiklemek için.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const result = await auditAndFixTrendyolPrices(getD1());
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Kontrol edilemedi." },
      { status: 500 },
    );
  }
}
