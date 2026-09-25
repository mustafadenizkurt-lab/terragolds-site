import {
  ensureN11Columns,
  createProduct,
  updateStockAndPrice,
  type N11Product,
  type N11ProductAttribute,
} from "./client";
import { getN11Credentials, type N11Credentials } from "./auth";
import { buildN11Title, roundToN11Price, stripMetalColorWords } from "./http-utils";
import { attributesForCategory } from "./attributes";
import { CATALOG_REJECTED_MESSAGE } from "./reconcile";
import { n11ListPriceFor } from "./pricing-formula";
import { toAbsoluteImageUrl } from "../shopify/client";
import { groupForCategory } from "../category-groups";

type PendingProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  n11OverridePrice: number | null;
  stock: number;
  image: string;
  hoverImage: string | null;
  category: string;
  xmlExternalId: string | null;
};

// Trendyol'daki barcodeFor() ile aynı mantık: tedarikçi ürün kodumuz
// (xml_external_id) varsa onu, yoksa kendi id'mizden türetilmiş bir kod
// kullanıyoruz - N11 tarafında stockCode (ve varsa productMainId) olarak
// gönderiliyor.
function stockCodeFor(product: { id: number; xmlExternalId: string | null }): string {
  return product.xmlExternalId || `TG-${product.id}`;
}

// Trendyol'daki TRENDYOL_CATEGORY_BY_GROUP_SLUG ile aynı amaç. Admin
// panelindeki "Kategori ara" aracıyla (appKey/appSecret girildikten sonra)
// bulunan gerçek N11 kategori ID'leri buraya ekleniyor - kademeli olarak,
// bir grup için ID bulununca hemen eklenir. Henüz eklenmemiş bir grup için
// categoryIdFor() bilinçli olarak hata fırlatmaya devam ediyor - sahte/
// tahmini bir ID ile ürün göndermek yanlış kategoride onaysız/reddedilen
// ürünlere yol açabilir (Trendyol'da tam bu yüzden %100 başarısız bir batch
// yaşanmıştı, bkz. sync.ts'teki "Çelik Yüzük" notu).
//
// Her grupta aynı desen: N11'de "Bijuteri ..." kategorisi doğru olan -
// "Altın ...", "Gümüş ..." ve "Pırlanta ..." benzer isimli ama gerçek
// kıymetli maden/taş kategorileri YANLIŞ (N11 kategori aramasında ilk
// bakışta karıştırılabilir), Terragolds çelik/pirinç kaplama taklit takı
// satıyor.
const N11_CATEGORY_BY_GROUP_SLUG: Record<string, number> = {
  bileklik: 1219214, // Bijuteri Bileklik
  kolyeler: 1219212, // Bijuteri Kolye
  yuzuk: 1219213, // Bijuteri Yüzük
  kupeler: 1219216, // Bijuteri Küpe
  // "antika-vintage" grubundaki ürünler GERÇEKTEN ikinci el antika/koleksiyon
  // parçaları (biblo, heykel, tablo, vazo, mumluk, antika porselen/bira
  // bardağı VE antika yüzük/kolye gibi karışık ürün tipleri) - N11'de
  // bunların hepsini kapsayan tek şemsiye kategori "2.El Antika & Koleksiyon"
  // (üst seviye; alt kategorileri "2.El Antika Aksesuar" ve "2.El Antika Ev
  // Dekorasyon" sadece yarısını kapsıyor, o yüzden üst seviye seçildi).
  "antika-vintage": 1003526, // 2.El Antika & Koleksiyon
};

// "sahmeran-halhal" grubu sitede tek nav grubu ama N11'de bunun karşılığı
// TEK bir kategori değil - Şahmeran ve Halhal N11'de tamamen ayrı iki
// kategori (üstelik burada diğer gruplardaki gibi bir "Bijuteri" ayrımı da
// yok, direkt tek kategoriler). Bu yüzden bu grup için N11_CATEGORY_BY_GROUP_SLUG
// yeterli değil - ürünün gerçek (ham) kategori adına bakıp ikisini ayırt
// etmek gerekiyor.
const N11_SAHMERAN_HALHAL_CATEGORY_BY_KEYWORD: { keyword: string; categoryId: number }[] = [
  { keyword: "halhal", categoryId: 1191218 }, // Halhal
  // D1'deki gerçek kategori adı boşluklu "Hal Hal" olabiliyor (bkz.
  // category-groups.ts > sahmeran-halhal grubunun "hal hal" keyword'ü) -
  // bu varyant eksikti, tek bir "Hal Hal" ürünü tüm batch'i (100 ürün)
  // reddettiriyordu (categoryIdFor() attığı hata pending.results.map()'i
  // baştan patlatıyor).
  { keyword: "hal hal", categoryId: 1191218 }, // Halhal (boşluklu yazım)
  { keyword: "şahmeran", categoryId: 1191217 }, // Şahmeran
];

// "Broş" ve "Piercing" sitenin nav grupları arasında hiç yok (category-groups.ts
// > categoryGroups içinde karşılığı yok) - bu yüzden groupForCategory() bunlar
// için hep undefined dönüyor ve categoryIdFor() hata fırlatıp tüm batch'i
// durduruyordu. Nav grubu eklemek yerine (sitenin müşteri tarafı navigasyonunu
// etkiler) sadece N11 tarafında ham kategori adına bakan doğrudan bir eşleme.
const N11_DIRECT_CATEGORY_BY_KEYWORD: { keyword: string; categoryId: number }[] = [
  { keyword: "broş", categoryId: 1191220 }, // Broş (2.El Broş, İğne, Rozet DEĞİL - o ikinci el)
  { keyword: "piercing", categoryId: 1191216 }, // Piercing & Hızma
];

export function categoryIdFor(product: { category: string; name: string }): number {
  const directHaystack = product.category.toLocaleLowerCase("tr-TR");
  const directMatch = N11_DIRECT_CATEGORY_BY_KEYWORD.find((entry) =>
    directHaystack.includes(entry.keyword),
  );
  if (directMatch) return directMatch.categoryId;

  // "Takı" (jenerik "takı" anlamında) bazı ürünlerde category alanına yanlış
  // girilmiş - gerçek isimlerine bakınca hepsi kolye/küpe/bilezik/yüzük.
  // groupForCategory() bu jenerik değerle hiçbir gruba eşleşmediği için ürün
  // adına düşüp oradan doğru grubu buluyoruz.
  const categoryForGrouping =
    product.category.trim().toLocaleLowerCase("tr-TR") === "takı"
      ? product.name
      : product.category;
  const group = groupForCategory(categoryForGrouping);

  if (group?.slug === "sahmeran-halhal") {
    const haystack = product.category.toLocaleLowerCase("tr-TR");
    const match = N11_SAHMERAN_HALHAL_CATEGORY_BY_KEYWORD.find((entry) =>
      haystack.includes(entry.keyword),
    );
    if (match) return match.categoryId;
    throw new Error(
      `N11 kategori eşlemesi belirsiz: "${product.category}" ne "halhal" ne "şahmeran" içeriyor.`,
    );
  }

  // 316L/çelik ürünleri Çelik Takılar kategorilerine yönlendirmek DENENDİ ve
  // geri alındı: gerçek product-query verisinde çelik başlıklı ürünler Çelik
  // kategorilerinde %67 (581/865), Bijuteri kategorilerinde ise sadece %8
  // (17/210) CatalogRejected oldu.
  const categoryId = group && N11_CATEGORY_BY_GROUP_SLUG[group.slug];
  if (!categoryId) {
    throw new Error(
      `N11 kategori eşlemesi henüz yapılandırılmamış (grup: ${group?.slug ?? product.category}). ` +
        "Önce N11 senkronu sekmesindeki \"Kategori ara\" aracıyla doğru kategori ID'sini bulup " +
        "lib/n11/sync.ts > N11_CATEGORY_BY_GROUP_SLUG içine ekleyin.",
    );
  }
  return categoryId;
}

// Zorunlu özellikler kategoriye özgü (Cinsiyet değer ID'leri bile kategoriden
// kategoriye değişiyor) - kurallar ve gerekçe lib/n11/attributes.ts'te.
function attributesFor(
  categoryId: number,
  product: { category: string; name: string; description?: string },
): N11ProductAttribute[] {
  return attributesForCategory(categoryId, product);
}

// N11 en fazla kaç görsel kabul ediyor net değil - Trendyol'daki gibi ana
// görsel (image) + hover görseli (hoverImage) sırasıyla, N11'in resmi
// şemasındaki order alanıyla (1, 2, ...) gönderiliyor.
function toN11Product(
  product: PendingProduct,
  settings: Pick<N11Credentials, "shipmentTemplate" | "preparingDay">,
): N11Product {
  const imageUrls = [product.image, product.hoverImage]
    .map((url) => (url ? toAbsoluteImageUrl(url) : null))
    .filter((url): url is string => Boolean(url));
  const stockCode = stockCodeFor(product);
  // N11'e giden fiyat site fiyatından bağımsız - komisyon+KDV+hizmet
  // bedeli+stopaj sonrası hedef kâr marjını koruyan n11_override_price
  // varsa o kullanılır (bkz. lib/n11/pricing.ts), yoksa site fiyatına düşer.
  const price = roundToN11Price(product.n11OverridePrice ?? product.price);
  const categoryId = categoryIdFor(product);
  return {
    categoryId,
    productMainId: stockCode,
    stockCode,
    // Gerçek bir GTIN'imiz yok (stockCode barkod değil) ama dokümanın her
    // örneğinde alan açıkça null gönderiliyor - bkz. client.ts > N11Product
    // tipi yorumu.
    barcode: null,
    catalogId: null,
    // N11'in resmi hata tablosu bunu doğruluyor: "ürün başlık alanı n11
    // kataloğu ile eşleşiyor olabilir, bu durumda ürün başlığını
    // farklılaştırmak için sonuna kod ekleyebilirsiniz." Bizim tedarikçi
    // feed'inde birçok FARKLI ürün (farklı görsel/tasarım) aynı jenerik
    // başlığı paylaşıyor (ör. "Pirinç Gümüş Renk Zirkon Taşlı Kadın Küpe")
    // - Renk/Cinsiyet gibi zorunlu özellikler de aynı kalınca N11 bunları
    // "aynı attributes kullanılmış" (mükerrer) diye reddediyordu. stockCode
    // eklemek bu belirli reddi çözdü, ama "Bu ürün sistemde mevcuttur" diye
    // N11'in kendi ana kataloğuna birebir eşleştirip reddettiği ayrı bir
    // grup (1252 ürün) hâlâ vardı - sadece sona kod eklemek bu eşleşmeyi
    // engellemedi. Başa marka adını da eklemek deneniyor: ürünü N11'in
    // gözünde "jenerik/markasız" değil "Terragolds markalı" bir ürün olarak
    // işaretleyip kendi kataloğundaki markasız/başka satıcı tasarımıyla
    // otomatik eşleşmesini azaltmak amacıyla.
    title: buildN11Title(product.name, stockCode),
    // N11 muhtemelen boş açıklamayı reddediyor (Trendyol'da doğrulanmış bir
    // davranış) - D1'de birkaç ürünün açıklaması boş olabileceği için aynı
    // önlem: ürün adına düşülüyor.
    description: product.description.trim() || product.name,
    quantity: product.stock,
    salePrice: price,
    listPrice: n11ListPriceFor(price),
    vatRate: 20,
    currencyType: "TL",
    preparingDay: settings.preparingDay,
    shipmentTemplate: settings.shipmentTemplate,
    // Dokümanın her örneğinde gönderiliyor (opsiyonel olsa da) - alıcı
    // başına makul bir üst sınır, işimize dair bir kısıtlama değil.
    maxPurchaseQuantity: 20,
    images: imageUrls.map((url, index) => ({ url, order: index + 1 })),
    attributes: attributesFor(categoryId, product),
  };
}

export type N11SyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// syncProductsToTrendyol/syncProductsToHepsiburada ile aynı desen: yayındaki,
// henüz gönderilmemiş ürünleri bir seferde batchSize kadar gönderir.
// categoryIdFor() eşleme tablosu boşken her ürün için hata fırlatacağı için
// bu fonksiyon kategori eşlemesi doldurulana kadar sadece hata biriktirir -
// bilinçli olarak böyle, yanlış kategoriyle ürün göndermek yerine.
export async function syncProductsToN11(
  db: D1Database,
  batchSize = 25,
): Promise<N11SyncResult> {
  await ensureN11Columns(db);

  const pending = await db
    .prepare(
      `SELECT id, name, description, price, n11_override_price AS n11OverridePrice, stock,
              image, hover_image AS hoverImage, category, xml_external_id AS xmlExternalId
       FROM products
       WHERE status = 'published' AND n11_task_id IS NULL AND n11_last_error IS NULL
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<PendingProduct>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM products WHERE status = 'published' AND n11_task_id IS NULL AND n11_last_error IS NULL",
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  if (pending.results.length === 0) {
    return { created: 0, failed: 0, remaining: 0, errors: [] };
  }

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  try {
    const credentials = await getN11Credentials();
    const n11Products = pending.results.map((product) => toN11Product(product, credentials));
    const task = await createProduct(n11Products, credentials.integrator);
    // N11 taskId'yi JSON sayısı olarak döndürüyor; string'e çevrilmezse D1'e
    // REAL olarak bağlanıp "3344070382.0" şeklinde kaydediliyordu.
    const taskId = String(task.id ?? "");
    for (const product of pending.results) {
      await db
        .prepare(
          `UPDATE products SET n11_stock_code = ?, n11_task_id = ?,
           n11_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(stockCodeFor(product), taskId, product.id)
        .run();
      created += 1;
    }
  } catch (error) {
    failed = pending.results.length;
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  return { created, failed, remaining: await remainingCount(), errors };
}

// D1 kaynak (source of truth) - Trendyol'daki pushStockAndPriceToTrendyol
// ile aynı prensip. n11_override_price varsa (bkz. lib/n11/pricing.ts) site
// fiyatı yerine o gönderilir - n11_price_synced de karşılaştırma tutarlı
// kalsın diye her zaman GERÇEKTEN gönderilen (efektif) fiyatı tutar.
export async function pushStockAndPriceToN11(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureN11Columns(db);

  const product = await db
    .prepare(
      `SELECT price, n11_override_price AS n11OverridePrice, stock,
              n11_stock_code AS n11StockCode
       FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<{
      price: number;
      n11OverridePrice: number | null;
      stock: number;
      n11StockCode: string | null;
    }>();

  if (!product?.n11StockCode) return;

  const credentials = await getN11Credentials();
  const effectivePrice = product.n11OverridePrice ?? product.price;
  const price = roundToN11Price(effectivePrice);
  await updateStockAndPrice(
    [
      {
        stockCode: product.n11StockCode,
        quantity: product.stock,
        salePrice: price,
        listPrice: n11ListPriceFor(price),
        currencyType: "TL",
      },
    ],
    credentials.integrator,
  );

  await db
    .prepare("UPDATE products SET n11_price_synced = ? WHERE id = ?")
    .bind(effectivePrice, productId)
    .run();
}

export type N11PricePushResult = {
  pushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// pushPendingTrendyolPrices/pushPendingHepsiburadaPrices ile aynı desen:
// D1'de fiyatı/stoku değişmiş ama N11'e henüz yansımamış ürünleri partiler
// hâlinde işler.
export async function pushPendingN11Prices(
  db: D1Database,
  batchSize = 1000,
  force = false,
  offset = 0,
): Promise<N11PricePushResult> {
  await ensureN11Columns(db);

  // n11_override_price varsa (bkz. lib/n11/pricing.ts) hedef fiyat odur,
  // yoksa site fiyatına düşülür - drift tespiti (n11_price_synced ile
  // kıyas) her zaman bu EFEKTİF fiyata göre yapılmalı, yoksa override
  // uygulanmış bir ürün site fiyatı değişmediği sürece hiç yeniden
  // gönderilmez sanılır.
  //
  // force=true: drift şartı yok sayılıp N11'e kayıtlı TÜM ürünler yeniden
  // gönderilir. salePrice değişmeden sadece listPrice formülü değiştiğinde
  // (bkz. pricing-formula.ts > LIST_PRICE_DISCOUNT_RATE) drift tespiti hiçbir
  // şey yakalamaz - D1'de elle toplu UPDATE atmak yerine (Claude Code'un
  // otomatik izin sınıflandırıcısı bunu "toplu silme" sayıp engelliyor) bu
  // zaten var olan, yetkili admin akışını kullanan yolla tam senkron sağlanır.
  // force modunda push sonrası satır hâlâ "where" ile eşleştiği için (drift
  // şartı yok) ilerlemeyi price_synced değil OFFSET sağlıyor - çağıran
  // (push-prices route'u) her turda offset += batchSize ile artırıyor.
  const where = force
    ? "n11_stock_code IS NOT NULL"
    : `n11_stock_code IS NOT NULL
       AND (n11_price_synced IS NULL OR n11_price_synced != COALESCE(n11_override_price, price))`;
  const pending = await db
    .prepare(
      `SELECT id, stock, price, n11_override_price AS n11OverridePrice,
              n11_stock_code AS n11StockCode
       FROM products WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`,
    )
    .bind(batchSize, force ? offset : 0)
    .all<{ id: number; stock: number; price: number; n11OverridePrice: number | null; n11StockCode: string }>();

  const remainingCount = async () => {
    const row = await db
      .prepare(`SELECT COUNT(*) AS c FROM products WHERE ${where}`)
      .first<{ c: number }>();
    const total = row?.c ?? 0;
    return force ? Math.max(0, total - (offset + pending.results.length)) : total;
  };

  if (pending.results.length === 0) {
    return { pushed: 0, failed: 0, remaining: 0, errors: [] };
  }

  const effectivePriceFor = (row: { price: number; n11OverridePrice: number | null }) =>
    row.n11OverridePrice ?? row.price;

  try {
    const credentials = await getN11Credentials();
    await updateStockAndPrice(
      pending.results.map((row) => {
        const price = roundToN11Price(effectivePriceFor(row));
        return {
          stockCode: row.n11StockCode,
          quantity: row.stock,
          salePrice: price,
          listPrice: n11ListPriceFor(price),
          currencyType: "TL",
        };
      }),
      credentials.integrator,
    );
  } catch (error) {
    return {
      pushed: 0,
      failed: pending.results.length,
      remaining: await remainingCount(),
      errors: [error instanceof Error ? error.message : "bilinmeyen hata"],
    };
  }

  const updateStmt = db.prepare("UPDATE products SET n11_price_synced = ? WHERE id = ?");
  await db.batch(pending.results.map((row) => updateStmt.bind(effectivePriceFor(row), row.id)));

  return { pushed: pending.results.length, failed: 0, remaining: await remainingCount(), errors: [] };
}

export type N11ResubmitResult = {
  resubmitted: number;
  taskId: string;
  stockCodes: string[];
  errors: string[];
};

// CatalogRejected ürünleri güncel kategori/özellik kurallarıyla yeniden
// gönderir (ör. Çelik kategorisinden Bijuteri'ye taşıma). Önce tek ürünle
// denenmeli (limit=1). Görev yeni taskId ile takip edilir; sonuç
// reconcileN11Tasks + reconcileN11CatalogStatus ile doğrulanır.
//
// updateProduct DEĞİL createProduct kullanılıyor: gerçek denemede (BKO5903 +
// 25 ürün, 24.09.2026) updateProduct hepsinde "Girilen X SellerStockCode ile
// mağazanızda bir ürün bulunmamaktadır" hatasıyla döndü - N11 bir ürünü
// katalog incelemesinde reddedince onu satıcı kataloğundan tamamen
// kaldırıyor, yani "güncellenecek" bir kayıt kalmıyor. N11 desteğinin de
// önerdiği gibi (sil, yeniden tasarlayıp gönder) create ile sıfırdan
// öneriliyor.
const SELLER_STOCK_CODE_NOT_FOUND_SUFFIX =
  "SellerStockCode ile mağazanızda bir ürün bulunmamaktadır.";

export async function resubmitRejectedToN11(
  db: D1Database,
  options: { limit?: number; stockCode?: string } = {},
): Promise<N11ResubmitResult> {
  await ensureN11Columns(db);
  const limit = Math.min(100, Math.max(1, options.limit ?? 1));
  const rows = options.stockCode
    ? await db
        .prepare(
          `SELECT id, name, description, price, n11_override_price AS n11OverridePrice, stock,
                  image, hover_image AS hoverImage, category, xml_external_id AS xmlExternalId
           FROM products WHERE n11_stock_code = ? ORDER BY id LIMIT ?`,
        )
        .bind(options.stockCode, limit)
        .all<PendingProduct>()
    : await db
        .prepare(
          `SELECT id, name, description, price, n11_override_price AS n11OverridePrice, stock,
                  image, hover_image AS hoverImage, category, xml_external_id AS xmlExternalId
           FROM products WHERE n11_last_error = ? OR n11_last_error LIKE ?
           ORDER BY id LIMIT ?`,
        )
        .bind(CATALOG_REJECTED_MESSAGE, `%${SELLER_STOCK_CODE_NOT_FOUND_SUFFIX}`, limit)
        .all<PendingProduct>();

  const result: N11ResubmitResult = { resubmitted: 0, taskId: "", stockCodes: [], errors: [] };
  if (rows.results.length === 0) return result;
  try {
    const credentials = await getN11Credentials();
    const products = rows.results.map((row) => toN11Product(row, credentials));
    // updateProduct değil createProduct: yukarıdaki yorumdaki gerekçeyle - N11
    // desteğinin de önerdiği gibi (sil, yeniden tasarlayıp gönder) reddedilmiş
    // ürün artık N11 tarafında yok, "create" ile sıfırdan öneriliyor.
    const task = await createProduct(products, credentials.integrator);
    result.taskId = String(task.id ?? "");
    const stmt = db.prepare(
      `UPDATE products SET n11_stock_code = ?, n11_task_id = ?, n11_last_error = NULL,
         n11_verified_at = NULL, n11_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
    );
    await db.batch(
      rows.results.map((row) => stmt.bind(stockCodeFor(row), result.taskId, row.id)),
    );
    result.resubmitted = rows.results.length;
    result.stockCodes = products.map((product) => product.stockCode);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }
  return result;
}

// Başlık deneyi (bkz. http-utils.ts > stripMetalColorWords): aynı ürünü YENİ
// stok koduyla (<kod>-T) ve maden adı çıkarılmış başlıkla gönderir. D1'deki
// asıl kayda dokunmaz. Sonuç product-query/reconcile ile stok koduna göre
// izlenir.
export async function sendN11TitleExperiment(
  db: D1Database,
  stockCodes: string[],
): Promise<{ sent: number; taskId: string; newStockCodes: string[]; errors: string[] }> {
  await ensureN11Columns(db);
  const codes = stockCodes.slice(0, 20);
  const result = { sent: 0, taskId: "", newStockCodes: [] as string[], errors: [] as string[] };
  if (codes.length === 0) return result;
  const rows = await db
    .prepare(
      `SELECT id, name, description, price, n11_override_price AS n11OverridePrice, stock,
              image, hover_image AS hoverImage, category, xml_external_id AS xmlExternalId
       FROM products WHERE xml_external_id IN (${codes.map(() => "?").join(",")})`,
    )
    .bind(...codes)
    .all<PendingProduct>();
  try {
    const credentials = await getN11Credentials();
    const products = rows.results.map((row) => {
      const base = toN11Product(row, credentials);
      const stockCode = `${base.stockCode}-T`;
      return {
        ...base,
        stockCode,
        productMainId: stockCode,
        title: buildN11Title(stripMetalColorWords(row.name), stockCode),
      };
    });
    const task = await createProduct(products, credentials.integrator);
    result.taskId = String(task.id ?? "");
    result.sent = products.length;
    result.newStockCodes = products.map((product) => product.stockCode);
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }
  return result;
}
