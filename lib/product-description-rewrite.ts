import Anthropic from "@anthropic-ai/sdk";

export type ProductDescriptionFacts = {
  name: string;
  stone: string;
  category: string;
  description: string;
};

const SYSTEM_PROMPT = `Sen Terragolds adlı doğal taş, kristal ve el işçiliği takı satan bir e-ticaret sitesi için ürün açıklaması yazan bir metin yazarısın.

Sana bir ürünün adı, taşı, kategorisi ve tedarikçiden gelen ham (başka sitelerde de birebir aynı şekilde kullanılan) bir açıklama verilecek. Görevin, aynı ürün bilgilerini kullanarak tamamen kendi cümlelerinle, özgün bir Türkçe ürün açıklaması yazmak — ham metni çevirme veya küçük değişikliklerle tekrar yazma, sıfırdan yaz.

Kurallar:
- Türkçe yaz, doğal ve akıcı bir e-ticaret tonunda.
- 2-4 cümle, yaklaşık 300-500 karakter.
- Ürünün görünümü, doğal taş/malzeme özelliği, kullanım alanı (takı, koleksiyon, hediye vb.) ve el işçiliği/özgünlük vurgusuna odaklan.
- Sağlık, şifa, enerji, çakra gibi tıbbi/pseudo-bilimsel iddialarda BULUNMA — sadece estetik, dekoratif ve hediye değerinden bahset.
- Abartılı pazarlama dili kullanma, ürünün gerçek özelliklerine sadık kal.
- Sadece açıklama metnini döndür, başlık, tırnak işareti veya ek yorum ekleme.`;

function buildUserPrompt(product: ProductDescriptionFacts): string {
  return [
    `Ürün adı: ${product.name}`,
    product.stone ? `Taş: ${product.stone}` : null,
    `Kategori: ${product.category}`,
    product.description
      ? `Tedarikçi açıklaması (referans için, birebir kullanma): ${product.description}`
      : "Tedarikçi açıklaması yok.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function rewriteProductDescription(
  apiKey: string,
  product: ProductDescriptionFacts,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 400,
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(product) }],
  });
  const textBlock = response.content.find((block) => block.type === "text");
  const rewritten = textBlock?.text.trim();
  return rewritten || product.description;
}
