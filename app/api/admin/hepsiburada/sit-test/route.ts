import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { runSitStep } from "../../../../../lib/hepsiburada/sit-tests";

export const dynamic = "force-dynamic";

// Hepsiburada test (SIT) sürecinin resmi adımlarını tek tek çalıştırır; ham
// yanıtı döner, D1'e yazmaz. Kimlik bilgilerinde ortam "test" değilse hiçbir
// istek atmaz. Sadece POST.
export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const body = (await request.json().catch(() => ({}))) as {
    step?: string;
    params?: Record<string, unknown>;
  };
  try {
    return Response.json(await runSitStep(String(body.step ?? ""), body.params ?? {}));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "SIT adımı çalıştırılamadı." },
      { status: 400 },
    );
  }
}
