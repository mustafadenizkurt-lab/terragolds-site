import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { pushPendingN11Prices } from "../../../../../lib/n11/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// ?all=1 (veya body.all): tek istekte remaining=0 olana kadar arka arkaya
// çağırır - listPrice formülü gibi TÜM zaten senkron ürünleri etkileyen bir
// değişiklikten sonra (bkz. lib/n11/pricing-formula.ts >
// LIST_PRICE_DISCOUNT_RATE) binlerce ürünü tek tek/birkaç kez tetiklemek
// yerine tek tıkla bitirebilmek için. Her tur en fazla 1000 ürün - N11'e tek
// bir updateStockAndPrice çağrısı (I/O ağırlıklı, Worker CPU süresini pek
// tüketmiyor), 3-4 tur toplamda birkaç saniye sürer.
const MAX_ROUNDS = 20;

// force=1: drift tespiti yok sayılır, N11'e kayıtlı TÜM ürünler yeniden
// gönderilir (bkz. lib/n11/sync.ts > pushPendingN11Prices force parametresi
// yorumu - sadece listPrice formülü değiştiğinde salePrice sabit kaldığından
// drift tespiti hiçbir şey yakalamaz). force modunda ilerleme price_synced
// değil OFFSET ile sağlanıyor, bu yüzden burada round'lar arası offset
// elle artırılıyor.
async function runAll(db: D1Database, batchSize: number, force: boolean) {
  const totals = { pushed: 0, failed: 0, remaining: 0, errors: [] as string[], rounds: 0 };
  let offset = 0;
  for (let i = 0; i < MAX_ROUNDS; i += 1) {
    const round = await pushPendingN11Prices(db, batchSize, force, offset);
    totals.pushed += round.pushed;
    totals.failed += round.failed;
    totals.remaining = round.remaining;
    totals.errors.push(...round.errors);
    totals.rounds += 1;
    offset += batchSize;
    if (round.remaining === 0 || round.pushed === 0 || round.errors.length > 0) break;
  }
  return totals;
}

async function run(request: Request, batchSize: number, all: boolean, force: boolean) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const db = getD1();
  try {
    const result = all
      ? await runAll(db, batchSize, force)
      : await pushPendingN11Prices(db, batchSize, force);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "N11 fiyat güncellemesi başarısız.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(1000, Math.max(1, Number(searchParams.get("batchSize")) || 1000));
  return run(request, batchSize, searchParams.get("all") === "1", searchParams.get("force") === "1");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    batchSize?: number;
    all?: boolean;
    force?: boolean;
  };
  const batchSize = Math.min(1000, Math.max(1, Number(body.batchSize) || 100));
  return run(request, batchSize, Boolean(body.all), Boolean(body.force));
}
