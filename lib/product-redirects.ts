// Ürün sayfası 404'lerini GSC'den temizlemek için: slug değiştiğinde ya da
// ürün silindiğinde eski adresin nereye gideceğini kaydeden/okuyan saf
// fonksiyonlar. app/products/[id]/page.tsx (okuma) ve
// app/api/admin/products/[id]/route.ts (yazma) tarafından kullanılıyor.

/** DB sorgusu gerektirmeyen, sabit anahtar kelime -> kategori eşlemesi. */
const CATEGORY_KEYWORDS: { pattern: RegExp; category: string }[] = [
  { pattern: /bileklik/i, category: "Bayan Bileklik" },
  { pattern: /kupe/i, category: "Küpe" },
  { pattern: /kolye/i, category: "Kolye" },
  { pattern: /yuzuk/i, category: "Bayan Yüzük ve Kombinler" },
  { pattern: /piercing/i, category: "Piercing" },
  { pattern: /hal-?hal/i, category: "Hal Hal" },
  { pattern: /bros/i, category: "Broş" },
  { pattern: /sahmeran/i, category: "Şahmeran" },
  { pattern: /saat/i, category: "Sevgili Saatleri" },
  { pattern: /charm/i, category: "Charm Bileklikler" },
];

const MALE_PREFIX = /\berkek\b/i;

/**
 * Sabit anahtar kelimelerle slug'dan kategori tahmini - veritabanına hiç
 * gitmiyor. "erkek" geçen slug'lar varsa önce "Erkek X" kategorisine
 * bakıyoruz (ör. "erkek-kolye" -> "Erkek Kolye"), yoksa genel kategoriye
 * düşüyor. Eşleşme yoksa null - çağıran taraf 410'a düşer.
 */
export function guessCategoryFromSlug(slug: string): string | null {
  const isMale = MALE_PREFIX.test(slug);
  for (const { pattern, category } of CATEGORY_KEYWORDS) {
    if (!pattern.test(slug)) continue;
    if (isMale) {
      const maleCategory = `Erkek ${category.replace(/^Bayan /, "").replace(/ ve Kombinler$/, "")}`;
      return maleCategory;
    }
    return category;
  }
  return null;
}

/** product_redirects'te bu eski slug için kayıtlı hedef varsa onu döner. */
export async function findManualRedirect(
  db: D1Database,
  oldSlug: string,
): Promise<string | null> {
  if (!oldSlug) return null;
  const row = await db
    .prepare("SELECT target_path FROM product_redirects WHERE old_slug = ?1 LIMIT 1")
    .bind(oldSlug)
    .first<{ target_path: string }>();
  return row?.target_path ?? null;
}

/**
 * Sonundaki "-1234" gibi bir sayı ekini atıp, kalan temel slug'a sahip
 * yayındaki bir ürün var mı diye bakar (ör. ".../kupe-1537" 404 veriyorsa
 * ".../kupe" hâlâ yayındaysa ona yönlendirilir). slug eşsiz olduğu için tek
 * satır okunur, "birden fazla eşleşme" riski yok.
 */
export async function findActiveProductByStrippedSlug(
  db: D1Database,
  missingSlug: string,
): Promise<string | null> {
  const match = /^(.+)-\d+$/.exec(missingSlug);
  if (!match) return null;
  const baseSlug = match[1];
  const row = await db
    .prepare("SELECT slug FROM products WHERE slug = ?1 AND status = 'published' LIMIT 1")
    .bind(baseSlug)
    .first<{ slug: string }>();
  return row?.slug ?? null;
}

async function upsertRedirect(db: D1Database, oldSlug: string, targetPath: string): Promise<void> {
  if (!oldSlug || oldSlug === targetPath) return;
  await db
    .prepare(
      `INSERT INTO product_redirects (old_slug, target_path) VALUES (?1, ?2)
       ON CONFLICT(old_slug) DO UPDATE SET target_path = excluded.target_path`,
    )
    .bind(oldSlug, targetPath)
    .run();
}

/** Admin panelde bir ürünün slug'ı değiştiğinde eski adres kaydedilir. */
export async function recordSlugChangeRedirect(
  db: D1Database,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  if (!oldSlug || !newSlug) return;
  await upsertRedirect(db, oldSlug, `/products/${newSlug}`);
}

/** Bir ürün silinince (taslağa alınsa da gerçekten silinse de) eski slug'ı kategori sayfasına yönlendirilir. */
export async function recordDeletionRedirect(
  db: D1Database,
  slug: string,
  categorySlug: string,
): Promise<void> {
  if (!slug) return;
  await upsertRedirect(db, slug, `/kategori/${categorySlug}`);
}
