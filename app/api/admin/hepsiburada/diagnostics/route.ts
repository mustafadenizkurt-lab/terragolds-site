import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  buildHepsiburadaAuthHeader,
  getHepsiburadaCredentials,
} from "../../../../../lib/hepsiburada/auth";
import { HEPSIBURADA_LISTING_API_BASE } from "../../../../../lib/hepsiburada/client";

export const dynamic = "force-dynamic";

// Bağlantı/kimlik doğrulama teşhis aracı: en hafif GET çağrısıyla
// (listing, limit=1) Hepsiburada'nın gerçek yanıtını gösterir. Salt okunur.
//
// ?userAgent=<ad> ile kayıtlı entegratör adı GEÇİCİ olarak ezilebilir
// (kayıtlı kimlik bilgilerini değiştirmeden) - Hepsiburada satıcı panelinde
// kayıtlı entegratör kullanıcı adı ("selfit_dev") ile burada saklanan ad
// ("terra_dev") uyuşmadığında 401 "Merchant api authorization failed"
// alınıyordu; bu, doğru User-Agent'ı kimlik bilgisini kaydetmeden sınamak için.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const override = new URL(request.url).searchParams.get("userAgent");
  try {
    const { merchantId, secretKey, integratorName } = await getHepsiburadaCredentials();
    const userAgent = override || integratorName;
    const response = await fetch(
      `${HEPSIBURADA_LISTING_API_BASE}/listings/merchantid/${merchantId}?limit=1`,
      {
        headers: {
          authorization: buildHepsiburadaAuthHeader(merchantId, secretKey),
          "user-agent": userAgent,
        },
      },
    );
    const text = await response.text();
    return Response.json({
      ok: response.ok,
      status: response.status,
      userAgentUsed: userAgent,
      body: text.slice(0, 1500),
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "bilinmeyen hata",
    });
  }
}
