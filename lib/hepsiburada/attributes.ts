// Kasıtlı olarak hiçbir şey import etmiyor (testler doğrudan import edebilsin).

// Hepsiburada kategori ID'leri GET /product/api/categories/get-all-categories
// (leaf=true) yanıtından, zorunlu özellikler GET .../categories/{id}/attributes
// yanıtından çıkarıldı (resmi doküman 403 verdiği için gerçek yanıttan).
// Tüm bu kategorilerde zorunlu: merchantSku, UrunAdi, Barcode, Marka,
// tax_vat_rate, Image1. Ek olarak sadece Yüzük ve Erkek Yüzük: cinsiyet (enum).
export const HB_CATEGORY = {
  kolye: 60001609, // Kadın > Kolye > Bijuteri Kolye
  yuzuk: 60001620, // Kadın > Yüzük > Bijuteri Yüzük
  kupe: 60001608, // Kadın > Küpe > Bijuteri Küpe
  bileklik: 60001611, // Kadın > Bileklik > Bijuteri Bileklik
  bilezik: 60001622, // Kadın > Bilezik > Bijuteri Bilezik
  bros: 60007599, // Kadın > Broş, Taç & Tarak > Bijuteri Broş, Taç & Tarak
  piercing: 60007596, // Kadın > Piercing > Bijuteri Piercing
  halhal: 16041428, // Kadın > Halhal
  erkekKolye: 60004718,
  erkekYuzuk: 60004717,
  erkekKupe: 60004719,
  erkekBileklik: 60004729,
} as const;

const YUZUK_CATEGORIES: number[] = [HB_CATEGORY.yuzuk, HB_CATEGORY.erkekYuzuk];

function lower(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

export function isMaleProduct(product: { category: string; name: string }): boolean {
  return lower(`${product.name} ${product.category}`).includes("erkek");
}

// Sitedeki ham kategori/ad -> Hepsiburada kategorisi. Karşılığı olmayan
// (Şahmeran, Antika/Vintage, Saat, Aksesuar) ürünler için null: sessizce
// yanlış kategoriye göndermek yerine çağıran atlar.
export function hepsiburadaCategoryFor(product: {
  category: string;
  name: string;
}): number | null {
  const category = lower(product.category);
  const name = lower(product.name);
  const male = isMaleProduct(product);
  if (category.includes("piercing")) return HB_CATEGORY.piercing;
  if (category.includes("broş")) return HB_CATEGORY.bros;
  if (category.includes("halhal") || category.includes("hal hal")) return HB_CATEGORY.halhal;
  if (category.includes("şahmeran") || category.includes("antika") || category.includes("vintage")) return null;
  if (category.includes("saat")) return null;
  const text = category.trim() === "takı" ? name : category;
  if (text.includes("yüzük")) return male ? HB_CATEGORY.erkekYuzuk : HB_CATEGORY.yuzuk;
  if (text.includes("kolye")) return male ? HB_CATEGORY.erkekKolye : HB_CATEGORY.kolye;
  if (text.includes("küpe")) return male ? HB_CATEGORY.erkekKupe : HB_CATEGORY.kupe;
  if (text.includes("bilezik")) return HB_CATEGORY.bilezik;
  if (text.includes("bileklik")) return male ? HB_CATEGORY.erkekBileklik : HB_CATEGORY.bileklik;
  return null;
}

export type HepsiburadaImportItem = {
  categoryId: number;
  merchant: string;
  attributes: Record<string, string>;
};

// Hepsiburada Barcode alanı EAN-13 bekliyor (13 hane, sağlama toplamlı;
// resmi rehber: "Barkod 13 karakterden oluşup kendi içinde bir algoritmaya
// sahip olmalıdır"). Ürünlerimizin gerçek GTIN'i yok - EAN-13'ün mağaza içi
// kullanım için ayrılmış "2" ön ekiyle (20-29) ürün id'sinden deterministik
// ve tekil bir barkod üretiyoruz. Hepsiburada kataloğunda karşılığı olmayacağı
// için ürünler "İncelenecek" (giriş ekibi kontrolü) statüsüne düşer.
export function internalEan13(productId: number): string {
  const body = "2" + String(productId).padStart(11, "0").slice(-11);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return body + String(check);
}

// merchantSku büyük harf ve boşluksuz gönderilmeli (resmi rehber).
export function normalizeMerchantSku(value: string): string {
  return value.replace(/\s+/g, "").toLocaleUpperCase("en-US");
}

// Resmi ürün adı kuralları: marka ile başlamalı, her kelimenin ilk harfi
// büyük, model kodları (rakam içeren) olduğu gibi/büyük.
export function hepsiburadaTitle(name: string, brand = "Terragolds"): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      /\d/.test(word)
        ? word.toLocaleUpperCase("tr-TR")
        : word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1).toLocaleLowerCase("tr-TR"),
    );
  const title = words.join(" ");
  return title.toLocaleLowerCase("tr-TR").startsWith(brand.toLocaleLowerCase("tr-TR"))
    ? title
    : `${brand} ${title}`;
}

// Fiyat: virgülle, en fazla 2 hane ("14,50") - resmi rehber.
export function hepsiburadaPrice(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2).replace(".", ",");
}

export function buildImportItem(input: {
  merchantId: string;
  categoryId: number;
  productId: number;
  merchantSku: string;
  title: string;
  description: string;
  images: string[];
  male: boolean;
  price: number;
  stock: number;
}): HepsiburadaImportItem {
  const merchantSku = normalizeMerchantSku(input.merchantSku);
  const attributes: Record<string, string> = {
    merchantSku,
    VaryantGroupID: merchantSku,
    Barcode: internalEan13(input.productId),
    UrunAdi: hepsiburadaTitle(input.title),
    UrunAciklamasi: input.description,
    Marka: "Terragolds",
    tax_vat_rate: "20",
    // Fiyat/stok ürünle birlikte gönderilirse, ürün onaylanınca bu değerlerle
    // otomatik satışa açılır (resmi rehber) - ayrı listing çağrısı gerekmez.
    price: hepsiburadaPrice(input.price),
    stock: String(Math.max(0, Math.floor(input.stock))),
  };
  input.images.slice(0, 5).forEach((url, index) => {
    attributes[`Image${index + 1}`] = url;
  });
  if (YUZUK_CATEGORIES.includes(input.categoryId)) {
    attributes.cinsiyet = input.male ? "Erkek" : "Kadın";
  }
  return { categoryId: input.categoryId, merchant: input.merchantId, attributes };
}
