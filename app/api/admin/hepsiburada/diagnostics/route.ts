import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getProducts } from "../../../../../lib/hepsiburada/client";

export const dynamic = "force-dynamic";

// Bağlantı/kimlik doğrulama teşhis aracı: Hepsiburada'nın gerçek onaylı
// kimlik bilgileriyle daha önce hiç canlı doğrulanmadığı, sadece
// dokümantasyona dayanarak yazıldığı (bkz. lib/hepsiburada/client.ts'teki
// notlar) ve daha önce kalıcı 403 hataları alındığı biliniyor - kök sebep
// yanlış header/endpoint mi yoksa Hepsiburada'nın IP whitelist zorunluluğu
// mu (resmi dokümantasyonda "testlere başlamadan statik IP bildirin"
// uyarısı var, Cloudflare Workers'ın sabit bir çıkış IP'si yok) belirsiz.
// Bu, en hafif GET çağrısıyla (getProducts, limit=1) gerçek hata
// metnini/kodunu görmek için.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const result = await getProducts({ limit: 1 });
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "bilinmeyen hata",
      },
      { status: 200 },
    );
  }
}
