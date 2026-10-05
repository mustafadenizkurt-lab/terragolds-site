import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { refreshHepsiburadaTitles } from "../../../../../lib/hepsiburada/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Tedarikçinin pirinçten çeliğe geçmesiyle düzeltilen ürün adlarını (bkz.
// lib/xml-sync/material-correction.ts) zaten Hepsiburada'ya gönderilmiş
// ürünlere yeniden gönderir. Tek seferlik araç - tekrar çalıştırmak
// zararsız (aynı başlığı tekrar göndermek no-op).
async function handle(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(100, Math.max(1, Number(searchParams.get("batchSize")) || 100));
  try {
    const result = await refreshHepsiburadaTitles(getD1(), batchSize);
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
  return handle(request);
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return handle(request);
}
