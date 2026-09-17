import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import {
  disableBirfaturaAccess,
  getBirfaturaStatus,
  regenerateBirfaturaApiKey,
} from "../../../../lib/birfatura";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  return Response.json(await getBirfaturaStatus(), {
    headers: { "cache-control": "no-store" },
  });
}

// Yeni bir anahtar üretir (varsa eskisini geçersiz kılar) ve düz metin
// olarak SADECE bu yanıtta döner - admin panelinde bir daha gösterilmez.
export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  const apiKey = await regenerateBirfaturaApiKey(admin.id);
  return Response.json({ apiKey, status: await getBirfaturaStatus() });
}

export async function DELETE(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  await disableBirfaturaAccess(admin.id);
  return Response.json({ status: await getBirfaturaStatus() });
}
