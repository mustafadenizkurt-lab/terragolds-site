import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  buildHepsiburadaAuthHeader,
  buildHepsiburadaUserAgent,
  getHepsiburadaCredentials,
} from "../../../../../lib/hepsiburada/auth";
import { HEPSIBURADA_LISTING_API_BASE } from "../../../../../lib/hepsiburada/client";
import { applyHepsiburadaEnvironment } from "../../../../../lib/hepsiburada/http-utils";

export const dynamic = "force-dynamic";

// Bağlantı/kimlik doğrulama teşhis aracı: en hafif GET çağrısıyla
// (listing, limit=1) Hepsiburada'nın gerçek yanıtını gösterir. Salt okunur.
//
// Kayıtlı entegratör adı dışında bir User-Agent göndermeye izin VERİLMEZ
// (Hepsiburada başkasına ait entegratör adının kullanılmasını yasakladı).
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const params = new URL(request.url).searchParams;
  const authUserOverride = params.get("authUser");
  try {
    const { merchantId, secretKey, integratorName, environment } = await getHepsiburadaCredentials();
    const userAgent = buildHepsiburadaUserAgent(integratorName);
    const response = await fetch(
      `${applyHepsiburadaEnvironment(HEPSIBURADA_LISTING_API_BASE, environment)}/listings/merchantid/${merchantId}?limit=1`,
      {
        headers: {
          authorization: buildHepsiburadaAuthHeader(authUserOverride || merchantId, secretKey),
          "user-agent": userAgent,
        },
      },
    );
    const text = await response.text();
    return Response.json({
      ok: response.ok,
      status: response.status,
      userAgentUsed: userAgent,
      authUserUsed: authUserOverride || merchantId,
      // Sadece meta bilgi (anahtarın kendisi ASLA döndürülmez): boşluk/özel
      // karakter ve uzunluk, yanlış yapıştırma ihtimalini ayıklamak için.
      secretMeta: {
        length: secretKey.length,
        hasWhitespace: /\s/.test(secretKey),
        alphanumericOnly: /^[A-Za-z0-9]+$/.test(secretKey),
      },
      integratorName,
      body: text.slice(0, 1500),
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "bilinmeyen hata",
    });
  }
}
