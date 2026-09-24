import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  applyHepsiburadaDynamicPricing,
  previewHepsiburadaDynamicPricing,
} from "../../../../../lib/hepsiburada/pricing";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Maliyet + kargo + komisyon (%22) sonrası en az maliyetin %50'si net kâr
// kalacak şekilde Hepsiburada satış fiyatını hesaplayıp yükseltir (bkz.
// lib/hepsiburada/pricing.ts). GET saf önizleme (hiçbir şeyi değiştirmez); fiyatı uygulamak için
// SADECE POST (GET ile veri yazmak, adres çubuğu/bağlantı üzerinden yanlışlıkla
// veya başka bir siteden tetiklenmeye açıktı).
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const preview = await previewHepsiburadaDynamicPricing(getD1());
  return Response.json(preview);
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const result = await applyHepsiburadaDynamicPricing(getD1());
  return Response.json(result);
}
