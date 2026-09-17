import {
  BIRFATURA_PAYMENT_METHOD_MAP,
  verifyBirfaturaRequest,
} from "../../../lib/birfatura";

export const dynamic = "force-dynamic";

// BirFatura'nın "Özel Entegrasyon API" dokümanına göre zorunlu 3
// endpoint'ten biri - mağaza kurulumu sırasında sitemizdeki ödeme
// yöntemlerini çeker. Yanıt şeması dokümandaki örnekle birebir doğrulandı:
// { "PaymentMethods": [{ "Id": number, "Value": string }, ...] }
//
// orderStatus'ta olduğu gibi dokümanın cURL/PHP örnekleri POST, C# örneği
// GET kullanıyor - ikisini de kabul ediyoruz.
async function handle(request: Request) {
  if (!(await verifyBirfaturaRequest(request))) {
    return Response.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  return Response.json({
    PaymentMethods: Object.values(BIRFATURA_PAYMENT_METHOD_MAP).map(
      (method) => ({ Id: method.id, Value: method.value }),
    ),
  });
}

export const GET = handle;
export const POST = handle;
