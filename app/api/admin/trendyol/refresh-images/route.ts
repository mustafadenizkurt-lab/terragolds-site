import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { refreshTrendyolImages } from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Zaten Trendyol'a gönderilmiş ürünlerin fotoğraflarını (hover_image
// backfillHoverImages ile yeni dolduruldu) günceller. Tek seferlik araç -
// tekrar çalıştırmak zararsız.
async function handle() {
  try {
    const result = await refreshTrendyolImages(getD1());
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Fotoğraflar güncellenemedi." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return handle();
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return handle();
}
