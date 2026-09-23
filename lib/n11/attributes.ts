// Kasıtlı olarak hiçbir şey import etmiyor (http-utils.ts ile aynı desen) -
// testler doğrudan import edebilsin.

export type N11Attribute = { id: number; valueId?: number; customValue?: string };

// GET /cdn/category/{id}/attribute ham yanıtından (9 kategorinin TAMAMI
// programatik olarak taranarak) çıkarılan gerçek isMandatory=true listeleri:
//   Bijuteri Yüzük (1219213):    Cinsiyet(22) + Marka(1) + Ölçü(1567) + Renk(429)
//   Bijuteri Kolye/Bileklik/Küpe (1219212/1219214/1219216): Cinsiyet(22) + Marka(1) + Renk(429)
//   Broş/Piercing/Şahmeran/Halhal (1191220/1191216/1191217/1191218): Marka(1) + Renk(429)
//   2.El Antika & Koleksiyon (1003526): zorunlu özellik YOK (Marka/Renk/
//     Cinsiyet bu kategoride hiç tanımlı değil - göndermek geçersiz ID olur)
type CategoryRule = { gender: boolean; size: boolean; brandAndColor: boolean };

const RULES: Record<number, CategoryRule> = {
  1219213: { gender: true, size: true, brandAndColor: true },
  1219212: { gender: true, size: false, brandAndColor: true },
  1219214: { gender: true, size: false, brandAndColor: true },
  1219216: { gender: true, size: false, brandAndColor: true },
  1191220: { gender: false, size: false, brandAndColor: true },
  1191216: { gender: false, size: false, brandAndColor: true },
  1191217: { gender: false, size: false, brandAndColor: true },
  1191218: { gender: false, size: false, brandAndColor: true },
  1003526: { gender: false, size: false, brandAndColor: false },
};

// Cinsiyet değer ID'leri KATEGORİYE ÖZGÜ (yüzükteki "Kadın" ID'si kolyede
// geçersiz) - ham yanıttan alındı.
type GenderIds = { erkek: number; kadin: number; unisex: number; cocuk: number };
const GENDER_IDS: Record<number, GenderIds> = {
  1219213: { erkek: 2467475, kadin: 2467568, unisex: 2467536, cocuk: 16358103 },
  1219212: { erkek: 2480550, kadin: 2480474, unisex: 2480444, cocuk: 11095952 },
  1219214: { erkek: 2475352, kadin: 2475283, unisex: 2475355, cocuk: 10993761 },
  1219216: { erkek: 2468122, kadin: 2468071, unisex: 2468125, cocuk: 16224780 },
};

function lower(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

export function genderValueId(
  categoryId: number,
  product: { category: string; name: string },
): number | null {
  const ids = GENDER_IDS[categoryId];
  if (!ids) return null;
  const haystack = lower(`${product.name} ${product.category}`);
  if (haystack.includes("erkek")) return ids.erkek;
  if (haystack.includes("unisex")) return ids.unisex;
  if (haystack.includes("çocuk")) return ids.cocuk;
  return ids.kadin;
}

// Renk (429) isCustomValue=true (serbest metin) ama N11'in kendi listesindeki
// yazımlarla (Altın, Gümüş, Rose Gold...) eşleştirmek filtrelemede daha iyi.
// Ürün adındaki İLK geçen renk kelimesi kazanır ("Gold Gümüş" -> Altın).
const COLOR_RULES: { pattern: RegExp; color: string }[] = [
  { pattern: /rose|roze|pembe altın/, color: "Rose Gold" },
  { pattern: /gümüş|silver|gumus/, color: "Gümüş" },
  { pattern: /gold|altın|altin/, color: "Altın" },
  { pattern: /siyah|black/, color: "Siyah" },
  { pattern: /bronz/, color: "Bronz" },
  { pattern: /bakır/, color: "Bakır" },
  { pattern: /beyaz|white/, color: "Beyaz" },
  { pattern: /lacivert/, color: "Lacivert" },
  { pattern: /mavi|blue/, color: "Mavi" },
  { pattern: /kırmızı|\bred\b/, color: "Kırmızı" },
  { pattern: /yeşil|green/, color: "Yeşil" },
  { pattern: /mor\b|purple/, color: "Mor" },
  { pattern: /pembe|pink/, color: "Pembe" },
  { pattern: /turuncu/, color: "Turuncu" },
  { pattern: /bordo/, color: "Bordo" },
  { pattern: /kahve/, color: "Kahverengi" },
  { pattern: /renkli|multi/, color: "Çok Renkli" },
];

export function colorFor(product: { name: string; description?: string }): string {
  for (const source of [product.name, product.description ?? ""]) {
    const text = lower(source);
    let best: { index: number; color: string } | null = null;
    for (const rule of COLOR_RULES) {
      const match = rule.pattern.exec(text);
      if (match && (best === null || match.index < best.index)) {
        best = { index: match.index, color: rule.color };
      }
    }
    if (best) return best.color;
  }
  // "Diğer" Renk listesinde gerçekten mevcut bir değer.
  return "Diğer";
}

// Ölçü (1567) yüzük için zorunlu, isCustomValue=true. Listedeki gerçek
// örnekler: "17", "17-18", "17-18 Numara", "Ayarlanabilir", "Tek Ebat",
// "Standart". Ürün adında açık bir numara yoksa "Standart" (listede var).
export function ringSizeFor(product: { name: string }): string {
  const text = lower(product.name);
  if (text.includes("ayarlanabilir") || text.includes("ayarlamalı") || text.includes("ayarlı")) return "Ayarlanabilir";
  const match = /(?:no|numara|beden|ölçü)\s*[:.]?\s*(\d{2}(?:\s*-\s*\d{2})?)|(\d{2}(?:\s*-\s*\d{2})?)\s*(?:numara|no\b)/.exec(
    text,
  );
  const size = match?.[1] ?? match?.[2];
  return size ? size.replace(/\s+/g, "") : "Standart";
}

export function attributesForCategory(
  categoryId: number,
  product: { category: string; name: string; description?: string },
): N11Attribute[] {
  const rule = RULES[categoryId];
  if (!rule) {
    throw new Error(
      `N11 kategori ${categoryId} için zorunlu özellik kuralı tanımlı değil (lib/n11/attributes.ts).`,
    );
  }
  const attributes: N11Attribute[] = [];
  if (rule.brandAndColor) attributes.push({ id: 1, customValue: "Terragolds" });
  if (rule.gender) {
    const valueId = genderValueId(categoryId, product);
    if (valueId !== null) attributes.push({ id: 22, valueId });
  }
  if (rule.size) attributes.push({ id: 1567, customValue: ringSizeFor(product) });
  if (rule.brandAndColor) attributes.push({ id: 429, customValue: colorFor(product) });
  return attributes;
}
