import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import { ensureTrendyolColumns } from "../../../../../lib/trendyol/client";

export const dynamic = "force-dynamic";

// Trendyol dinamik fiyatlama botunun bir ürün için uyacağı taban/tavan
// fiyatı (ve botun o ürünü hiç fiyatlamasını isteyip istemediğini) ayarlar -
// bkz. lib/trendyol/pricing.ts > clampToPriceLimits. ?id= (bizim ürün
// id'miz) veya ?barcode= (Trendyol barkodu) ile çağrılabilir.
// lowerLimitPrice/upperLimitPrice: boş bırakılırsa dokunulmaz, "clear"
// gönderilirse NULL'lanır (sınır kaldırılır). active: "0" veya "1".
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const barcode = searchParams.get("barcode");
    if (!id && !barcode) {
      return Response.json({ error: "id veya barcode parametresi gerekli." }, { status: 400 });
    }
    if (id && (!Number.isInteger(Number(id)) || Number(id) <= 0)) {
      return Response.json({ error: "Geçersiz ürün id'si." }, { status: 400 });
    }

    const parseLimit = (param: string | null): { set: boolean; value: number | null } => {
      if (param === null) return { set: false, value: null };
      if (param === "clear") return { set: true, value: null };
      const n = Number(param);
      if (!Number.isFinite(n) || n < 0) throw new Error(`Geçersiz fiyat: ${param}`);
      return { set: true, value: Math.round(n) };
    };
    const lower = parseLimit(searchParams.get("lowerLimitPrice"));
    const upper = parseLimit(searchParams.get("upperLimitPrice"));
    const activeParam = searchParams.get("active");
    const active = activeParam === null ? null : activeParam === "1" ? 1 : 0;

    if (!lower.set && !upper.set && active === null) {
      return Response.json(
        { error: "lowerLimitPrice, upperLimitPrice veya active parametrelerinden en az biri gerekli." },
        { status: 400 },
      );
    }

    const db = getD1();
    await ensureTrendyolColumns(db);
    const where = id ? "id = ?" : "trendyol_barcode = ?";
    const bindValue = id ? Number(id) : barcode;

    const sets: string[] = ["updated_at = CURRENT_TIMESTAMP"];
    const values: (string | number | null)[] = [];
    if (lower.set) {
      sets.push("trendyol_lower_limit_price = ?");
      values.push(lower.value);
    }
    if (upper.set) {
      sets.push("trendyol_upper_limit_price = ?");
      values.push(upper.value);
    }
    if (active !== null) {
      sets.push("trendyol_active = ?");
      values.push(active);
    }
    values.push(bindValue);

    const result = await db
      .prepare(`UPDATE products SET ${sets.join(", ")} WHERE ${where}`)
      .bind(...values)
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "İşlem başarısız." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
