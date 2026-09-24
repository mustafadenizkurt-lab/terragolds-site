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
// değiştirmez); fiyatı uygulamak için SADECE POST (GET ile veri yazmak,
// adres çubuğu/bağlantı üzerinden yanlışlıkla veya başka bir siteden
// tetiklenmeye açıktı).
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const preview = await previewN11DynamicPricing(getD1());
  return Response.json(preview);
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const result = await applyN11DynamicPricing(getD1());
  return Response.json(result);
}
