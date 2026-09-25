import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  buildHepsiburadaAuthHeader,
  buildHepsiburadaUserAgent,
  getHepsiburadaCredentials,
} from "../../../../../lib/hepsiburada/auth";
import {
  HEPSIBURADA_LISTING_API_BASE,
  HEPSIBURADA_ORDER_API_BASE,
  HEPSIBURADA_PRODUCT_API_BASE,
} from "../../../../../lib/hepsiburada/client";
import { applyHepsiburadaEnvironment } from "../../../../../lib/hepsiburada/http-utils";

export const dynamic = "force-dynamic";

const BASES: Record<string, string> = {
  product: HEPSIBURADA_PRODUCT_API_BASE,
  listing: HEPSIBURADA_LISTING_API_BASE,
  order: HEPSIBURADA_ORDER_API_BASE,
};

// Salt okunur keşif aracı: Hepsiburada'nın gerçek yanıtlarını (kategori
// ağacı, kategori özellikleri, ürün durumu) görmek için. SADECE GET ve sadece
// bilinen okuma yolları - hiçbir şey değiştirmez. Resmi dokümana (403)
// erişilemediği için şemayı gerçek yanıtlardan çıkarmakta kullanılıyor.
// ?base=product|listing|order&path=/product/api/...&<diğer parametreler
// olduğu gibi iletilir>
const ALLOWED_PATH = /^\/(product\/api\/(categories|products|brands)|listings\/merchantid|orders\/merchantid|packages\/merchantid)/;

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const url = new URL(request.url);
  const base = BASES[url.searchParams.get("base") ?? "product"];
  const path = url.searchParams.get("path") ?? "";
  if (!base || !ALLOWED_PATH.test(path) || path.includes("..")) {
    return Response.json({ error: "İzin verilmeyen base/path." }, { status: 400 });
  }

  const forwarded = new URLSearchParams(url.search);
  forwarded.delete("base");
  forwarded.delete("path");
  const query = forwarded.toString();

  try {
    const { merchantId, secretKey, integratorName, environment } = await getHepsiburadaCredentials();
    const response = await fetch(`${applyHepsiburadaEnvironment(base, environment)}${path}${query ? `?${query}` : ""}`, {
      headers: {
        authorization: buildHepsiburadaAuthHeader(merchantId, secretKey),
        "user-agent": buildHepsiburadaUserAgent(integratorName),
        accept: "application/json",
      },
    });
    const text = await response.text();
    return Response.json({
      status: response.status,
      length: text.length,
      body: text.length > 200_000 ? text.slice(0, 200_000) : text,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "bilinmeyen hata" });
  }
}
