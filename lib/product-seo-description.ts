import Anthropic from "@anthropic-ai/sdk";

export type ProductSeoFacts = {
  name: string;
  stone: string;
  category: string;
  description: string;
};

// Distinct from lib/product-description-rewrite.ts's SYSTEM_PROMPT (which
// replaces the visible `description` wholesale, 2-4 sentences): this one is
// deliberately shorter (2-3 sentences) and framed around the SEO goal - make
// each product page's crawled text genuinely unique across ~4650 products
// that otherwise share the exact same supplier copy, not just "different
// words for the same sentence".
const SYSTEM_PROMPT = `Sen Terragolds adlı takı ve aksesuar satan bir e-ticaret sitesi için SEO amaçlı ürün açıklaması yazan bir metin yazarısın.

Sana bir ürünün adı, taşı (varsa), kategorisi ve tedarikçiden gelen ham (başka onlarca sitede de birebir aynı şekilde kullanılan) bir açıklama verilecek. Görevin, arama motorlarının bu sayfayı kopya içerik olarak görmemesi için tamamen özgün, kendi cümlelerinle yazılmış kısa bir Türkçe açıklama üretmek.

Kurallar:
- Türkçe yaz, doğal ve akıcı bir e-ticaret tonunda.
- 2-3 cümle.
- Ham metni çevirme veya küçük değişikliklerle tekrar yazma - sıfırdan, farklı bir cümle yapısıyla yaz.
- Ürün adındaki ve kategorisindeki doğal anahtar kelimeleri (ör. ürün tipi, malzeme, taş adı) cümle içinde doğal şekilde geçir - anahtar kelime doldurma (keyword stuffing) yapma.
- Ürünün görünümü, malzeme özelliği ve kullanım alanına (günlük kullanım, hediye, koleksiyon vb.) odaklan.
- Sağlık, şifa, enerji, çakra gibi tıbbi/pseudo-bilimsel iddialarda BULUNMA - sadece estetik, dekoratif ve hediye değerinden bahset.
- Abartılı pazarlama dili kullanma, ürünün gerçek özelliklerine sadık kal.
- Sadece açıklama metnini döndür, başlık, tırnak işareti veya ek yorum ekleme.`;

function buildUserPrompt(product: ProductSeoFacts): string {
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

// Model kasıtlı olarak burada sabitlenmiş (çağıran script'in kendi
// argümanından değil) - istek üzerine "claude-sonnet-4-6" kullanılıyor.
// NOT: Bu tam model ID'sinin geçerliliği doğrulanmadı, bilinen güncel model
// adlandırma deseniyle (claude-sonnet-5, claude-opus-5, tarihli snapshot'lar
// gibi) örtüşmüyor - çalıştırmadan önce Anthropic hesabınızda gerçekten
// erişilebilir olduğunu teyit edin, aksi halde her istek "model not found"
// ile başarısız olur.
const MODEL = "claude-sonnet-4-6";

export async function generateSeoDescription(
  apiKey: string,
  product: ProductSeoFacts,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(product) }],
  });
  const textBlock = response.content.find((block) => block.type === "text");
  const generated = textBlock?.text.trim();
  if (!generated) {
    throw new Error("Claude boş bir yanıt döndürdü.");
  }
  return generated;
}
