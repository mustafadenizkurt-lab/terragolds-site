import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { pushMarketplaceImages } from "../../../../../lib/marketplace-images";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Admin panelinden görseli değiştirilip henüz Trendyol/Hepsiburada/N11'e
// gönderilmemiş ürünleri (bkz. lib/marketplace-images.ts) hemen gönderir.
// 6 saatlik cron da aynı kuyruğu işliyor; bu adres birikmiş kuyruğu
// beklemeden eritmek için. ?limit= (varsayılan 200, en fazla 500).
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
    const result = await pushMarketplaceImages(getD1(), {
      limit: Number.isFinite(limit) ? limit : 200,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Görseller gönderilemedi." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
