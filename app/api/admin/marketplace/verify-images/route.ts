import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { verifyMarketplaceImages } from "../../../../../lib/marketplace-image-verify";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Görseli değiştirilen ürünlerin Trendyol/Hepsiburada/N11'e yapılan son
// görsel gönderiminin pazaryerinde GERÇEKTEN işlenip işlenmediğini sorgular
// (salt-okunur). ?since=2026-10-17 (varsayılan: bugün), ?limit= (en fazla 300).
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since") || new Date().toISOString().slice(0, 10);
    const limit = Number(searchParams.get("limit") ?? 200);
    const result = await verifyMarketplaceImages(getD1(), {
      since,
      limit: Number.isFinite(limit) ? limit : 200,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Doğrulanamadı." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
