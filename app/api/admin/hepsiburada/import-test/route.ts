import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { importHepsiburadaTest } from "../../../../../lib/hepsiburada/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Geçici şema denemesi: en fazla 5 ürünü gerçek Hepsiburada içe aktarma
// şemasıyla gönderir, ham yanıtı döner, D1'e yazmaz. Sadece POST.
export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const body = (await request.json().catch(() => ({}))) as { stockCodes?: string[] };
  try {
    return Response.json(await importHepsiburadaTest(getD1(), body.stockCodes ?? []));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Deneme gönderilemedi." },
      { status: 500 },
    );
  }
}
