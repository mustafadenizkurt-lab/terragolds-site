import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import {
  applyTrendyolPriceIncrease,
  previewTrendyolPriceIncrease,
} from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Tek seferlik migration aracı: 0-200 TL arası Trendyol'a gönderilmiş
// ürünlere %20 zam uygular. GET saf önizleme (D1'e/Trendyol'a hiçbir şey
// yazmaz) - kaç ürün etkilenecek ve örnek eski/yeni fiyatlar; ?apply=1 ile
// tarayıcı adres çubuğundan da tetiklenebiliyor (recategorize'daki gibi).
// POST de aynı gerçek uygulamayı yapar; lib/trendyol/sync.ts'teki
// trendyol_price_increase_log tablosu sayesinde güvenle tekrar
// çalıştırılabilir (zaten işlenmiş ürünler otomatik atlanır).
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("apply") === "1") {
    const result = await applyTrendyolPriceIncrease(getD1());
    return Response.json(result);
  }
  const preview = await previewTrendyolPriceIncrease(getD1());
  return Response.json(preview);
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const result = await applyTrendyolPriceIncrease(getD1());
  return Response.json(result);
}
