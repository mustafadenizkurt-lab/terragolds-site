import {
  BIRFATURA_ORDER_STATUS_MAP,
  verifyBirfaturaRequest,
} from "../../../lib/birfatura";

export const dynamic = "force-dynamic";

// BirFatura'nın "Özel Entegrasyon API" dokümanına göre zorunlu 3
// endpoint'ten biri - mağaza kurulumu/güncellemesi sırasında sitemizdeki
// sipariş durumlarını çeker. Request body yok, sadece "token" header'ı ile
// kimlik doğrulanır. Yanıt şeması dokümandaki örnekle birebir doğrulandı:
// { "OrderStatus": [{ "Id": number, "Value": string }, ...] }
//
// Dokümandaki cURL ve PHP örnekleri POST, C# örneği ise GET (GetAsync)
// kullanıyor - dokümanın kendi içinde çelişkili. Body gerektirmediği için
// ikisini de kabul etmek zararsız, bu yüzden hem GET hem POST'a aynı yanıtı
// veriyoruz.
async function handle(request: Request) {
  if (!(await verifyBirfaturaRequest(request))) {
    return Response.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  return Response.json({
    OrderStatus: Object.values(BIRFATURA_ORDER_STATUS_MAP).map((status) => ({
      Id: status.id,
      Value: status.value,
    })),
  });
}

export const GET = handle;
export const POST = handle;
