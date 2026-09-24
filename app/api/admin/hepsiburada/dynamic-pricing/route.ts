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
// lib/hepsiburada/pricing.ts). GET saf önizleme (hiçbir şeyi değiştirmez);
// ?apply=1 ile tarayıcı adres çubuğundan da tetiklenebiliyor
// (Trendyol/N11'deki dynamic-pricing route'larıyla aynı desen).
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("apply") === "1") {
    const result = await applyHepsiburadaDynamicPricing(getD1());
    return Response.json(result);
  }
  const preview = await previewHepsiburadaDynamicPricing(getD1());
  return Response.json(preview);
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const result = await applyHepsiburadaDynamicPricing(getD1());
  return Response.json(result);
}
