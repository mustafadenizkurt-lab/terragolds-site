import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getTaskDetails } from "../../../../../lib/n11/client";

export const dynamic = "force-dynamic";

// POST /ms/product/task-details/page-query'nin ham yanıtını olduğu gibi
// döner - N11'in resmi dokümanında bu yanıtın tam zarfı (content mi, skus
// mu) örneklenmedi, bu yüzden tip zorlamadan (raw) gösteriliyor. Ürün
// gönderiminin (createProduct/updateProduct) gerçekten kabul edilip
// edilmediğini doğrulamak için kullanılıyor - taskId asenkron kuyruğa
// girdiğinde hemen "başarılı" görünse de gerçek durum burada netleşiyor.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) {
    return Response.json({ error: "Geçerli bir taskId gerekli." }, { status: 400 });
  }
  const page = Number(searchParams.get("page")) || 0;
  const size = Number(searchParams.get("size")) || 100;

  try {
    const result = await getTaskDetails(taskId, page, size);
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "N11 görev durumu alınamadı." },
      { status: 400 },
    );
  }
}
