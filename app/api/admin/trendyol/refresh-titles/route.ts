import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { refreshTrendyolTitles } from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Tedarikçinin pirinçten çeliğe geçmesiyle düzeltilen ürün adlarını (bkz.
// lib/xml-sync/material-correction.ts) zaten Trendyol'a gönderilmiş
// ürünlere yeniden gönderir. Tek seferlik araç - tekrar çalıştırmak
// zararsız (aynı adı tekrar göndermek no-op).
async function handle() {
  try {
    const result = await refreshTrendyolTitles(getD1());
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ürün adları güncellenemedi." },
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
