import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { sendN11TitleExperiment } from "../../../../../lib/n11/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Geçici deney: verilen stok kodlarını "<kod>-T" yeni stok koduyla ve maden
// adı çıkarılmış başlıkla N11'e gönderir (D1'e yazmaz). Sadece POST.
export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const body = (await request.json().catch(() => ({}))) as { stockCodes?: string[] };
  try {
    return Response.json(await sendN11TitleExperiment(getD1(), body.stockCodes ?? []));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Deney gönderilemedi." },
      { status: 500 },
    );
  }
}
