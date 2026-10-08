import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { backfillSeoDescriptions } from "../../../../../lib/seo-description-backfill";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// app/api/admin/products/fix-duplicate-descriptions/route.ts ile aynı desen.
const MAX_ROUNDS = 4;

async function runAll(db: D1Database, batchSize: number) {
  const totals = { filled: 0, failed: 0, remaining: 0, errors: [] as string[], rounds: 0 };
  for (let i = 0; i < MAX_ROUNDS; i += 1) {
    const round = await backfillSeoDescriptions(db, batchSize);
    totals.filled += round.filled;
    totals.failed += round.failed;
    totals.remaining = round.remaining;
    totals.errors.push(...round.errors);
    totals.rounds += 1;
    if (round.remaining === 0 || (round.filled === 0 && round.failed === 0)) break;
  }
  return totals;
}

async function run(request: Request, batchSize: number, all: boolean) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const db = getD1();
  try {
    const result = all
      ? await runAll(db, batchSize)
      : await backfillSeoDescriptions(db, batchSize);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "SEO açıklaması doldurma başarısız." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(20, Math.max(1, Number(searchParams.get("batchSize")) || 8));
  return run(request, batchSize, searchParams.get("all") === "1");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    batchSize?: number;
    all?: boolean;
  };
  const batchSize = Math.min(20, Math.max(1, Number(body.batchSize) || 8));
  return run(request, batchSize, Boolean(body.all));
}
