import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { resendHepsiburadaImages } from "../../../../../lib/hepsiburada/image-resend";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Görseli değiştirilmiş ürünleri SADECE Hepsiburada'ya yeniden gönderir
// (bkz. lib/hepsiburada/image-resend.ts). ?limit= (varsayılan 200, en fazla 400).
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
    return Response.json(await resendHepsiburadaImages(getD1(), Number.isFinite(limit) ? limit : 200));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Gönderilemedi." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
