import type { Product } from "./store-data";

// Google Merchant (merchant.xml) ve Meta Katalog (meta-catalog.xml) feed'leri
// aynı temel alanları (fiyat formatı, mutlak URL, kategori) kullanıyor - tek
// kaynaktan yönetilsin diye burada paylaşılıyor. İki platform da RSS 2.0 +
// "g:" ad alanı formatını kabul ediyor, sadece bazı alan DEĞERLERİ (ör.
// availability) farklı yazılıyor - o kısım her route'un kendi dosyasında.

export const SITE_URL = "https://www.terragolds.com";

export function escapeXml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function priceWithCurrency(price: number) {
  return `${Number(price).toFixed(2)} TRY`;
}

/**
 * Google/Meta ürün kategorisi, ürüne göre türetiliyor - katalog artık
 * ağırlıklı takı (yüzük/bileklik/kolye/küpe), doğal taş dekor değil, o
 * yüzden her ürüne tek bir sabit kategori vermek yanlıştı ve ilan
 * reddedilmesine yol açabiliyordu. Meta de bu Google taksonomisini kabul
 * ediyor, ayrı bir Meta-özel kategori haritası gerekmiyor.
 */
export function googleProductCategory(product: Pick<Product, "category" | "name" | "stone">): string {
  if (product.stone.trim()) return "Home & Garden > Decor";
  // Plain lowercase substring match against a tr-TR-lowercased haystack - bir
  // regex /i bayrağı Türkçe "İ"yi ASCII "i"ye çevirmiyor, o yüzden ör.
  // /bileklik/i.test("KADIN BİLEKLİK") sessizce eşleşmiyor.
  const haystack = `${product.category} ${product.name}`.toLocaleLowerCase("tr-TR");
  if (haystack.includes("yüzük")) return "Apparel & Accessories > Jewelry > Rings";
  if (haystack.includes("bileklik")) return "Apparel & Accessories > Jewelry > Bracelets";
  if (haystack.includes("kolye")) return "Apparel & Accessories > Jewelry > Necklaces";
  if (haystack.includes("küpe")) return "Apparel & Accessories > Jewelry > Earrings";
  if (haystack.includes("hal hal") || haystack.includes("halhal")) {
    return "Apparel & Accessories > Jewelry > Anklets";
  }
  return "Apparel & Accessories > Jewelry";
}

export function finalPriceFor(product: Pick<Product, "price" | "discountPercent">): number {
  return product.discountPercent > 0
    ? Math.max(0, Math.round(product.price * (1 - product.discountPercent / 100)))
    : product.price;
}
