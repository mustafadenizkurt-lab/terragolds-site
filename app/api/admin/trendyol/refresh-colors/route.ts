import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { refreshTrendyolColors } from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Önceden tüm ürünler için sabit "Gümüş" Web Color/Renk gönderiliyordu (bkz.
// lib/trendyol/sync.ts > trendyolColorFor) - ürün adında "Gold Renk" yazan
// ürünler bile Trendyol'da Gümüş görünüyordu. Zaten gönderilmiş ürünlere
// düzeltilmiş rengi yeniden gönderir. Tek seferlik araç - tekrar çalıştırmak
// zararsız (aynı attributes'u tekrar göndermek no-op).
async function handle() {
  try {
    const result = await refreshTrendyolColors(getD1());
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ürün renkleri güncellenemedi." },
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
