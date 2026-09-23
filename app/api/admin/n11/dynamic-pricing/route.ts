import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  applyN11DynamicPricing,
  previewN11DynamicPricing,
} from "../../../../../lib/n11/pricing";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Maliyet + kargo + komisyon(+KDV+hizmet bedeli+stopaj) sonrası en az
// maliyetin %50'si net kâr kalacak şekilde N11 satış fiyatını hesaplayıp
// yükseltir (bkz. lib/n11/pricing.ts). GET saf önizleme (hiçbir şeyi
// değiştirmez); ?apply=1 ile tarayıcı adres çubuğundan da tetiklenebiliyor
// (Trendyol'daki dynamic-pricing route'uyla aynı desen - POST'u browser'dan
// çalıştıramadığımız için).
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("apply") === "1") {
    const result = await applyN11DynamicPricing(getD1());
    return Response.json(result);
  }
  const preview = await previewN11DynamicPricing(getD1());
  return Response.json(preview);
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const result = await applyN11DynamicPricing(getD1());
  return Response.json(result);
}
