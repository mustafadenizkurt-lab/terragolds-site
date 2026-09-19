import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  applyTrendyolDynamicPricing,
  previewTrendyolDynamicPricing,
} from "../../../../../lib/trendyol/pricing";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Maliyet + kargo + komisyon sonrası en az maliyetin %50'si net kâr kalacak
// şekilde Trendyol satış fiyatını hesaplayıp yükseltir (bkz.
// lib/trendyol/pricing.ts). GET saf önizleme (hiçbir şeyi değiştirmez);
// ?apply=1 ile tarayıcı adres çubuğundan da tetiklenebiliyor
// (bulk-price-increase'daki gibi, POST'u browser'dan çalıştıramadığımız
// için). Cron ile tekrar tekrar çağrılmaya uygun - yalnızca gerçekten
// yükselmesi gereken fiyatlar gönderilir.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("apply") === "1") {
    const result = await applyTrendyolDynamicPricing(getD1());
    return Response.json(result);
  }
  const preview = await previewTrendyolDynamicPricing(getD1());
  return Response.json(preview);
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const result = await applyTrendyolDynamicPricing(getD1());
  return Response.json(result);
}
