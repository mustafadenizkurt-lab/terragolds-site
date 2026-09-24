import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { reconcileN11CatalogStatus, reconcileN11Tasks } from "../../../../../lib/n11/reconcile";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// GET ile de tetiklenebiliyor - resubmit-rejected route'undaki GET/POST
// deseniyle aynı gerekçe: admin paneli butonu zaten POST kullanıyor, ama
// cron'un bir sonraki çalışmasını beklemeden linke tıklayarak da manuel
// tetikleyebilmek için.
async function run(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const db = getD1();
    const tasks = await reconcileN11Tasks(db);
    const catalog = await reconcileN11CatalogStatus(db);
    return Response.json({ ...tasks, catalog });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "N11 sonuç doğrulaması başarısız." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
