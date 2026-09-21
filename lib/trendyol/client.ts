import { getTrendyolCredentials, getTrendyolEnvironment, buildTrendyolAuthHeader, buildTrendyolUserAgent } from "./auth";

// Trendyol Marketplace'in resmi entegrasyon dokümantasyonundaki temel URL.
// STAGE (sandbox) onay süreci için ayrı bir host kullanıyor - hangisinin
// aktif olduğu TRENDYOL_ENVIRONMENT'e göre auth.ts'te belirleniyor.
const TRENDYOL_API_BASE_BY_ENVIRONMENT = {
  prod: "https://apigw.trendyol.com/integration",
  stage: "https://stageapigw.trendyol.com/integration",
} as const;

export function trendyolApiBase(): string {
  return TRENDYOL_API_BASE_BY_ENVIRONMENT[getTrendyolEnvironment()];
}

type TrendyolErrorPayload = {
  errors?: { message?: string; code?: string }[];
};

// Trendyol dokümantasyonuna göre aynı endpoint'e 10 saniyede en fazla 50
// istek atılabilir, 51. istek 429 ("too.many.requests") döner. Kendi
// tarafımızdan bu limite hiç yaklaşmamak için endpoint (path, query hariç)
// başına kayan pencere (sliding window) ile istekleri throttle ediyoruz.
// Worker isolate'ının yaşam süresi boyunca bellekte tutuluyor - kalıcı bir
// depoya (KV/D1) ihtiyaç yok çünkü tek bir istek/cron içindeki art arda
// çağrıları korumak yeterli, isolate'lar arası kesin senkronizasyon
// gerekmiyor (gerçek trafiğimiz zaten bu limitin çok altında).
const RATE_LIMIT_MAX_REQUESTS = 50;
const RATE_LIMIT_WINDOW_MS = 10_000;
const requestTimestampsByEndpoint = new Map<string, number[]>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimit(endpoint: string): Promise<void> {
  const now = Date.now();
  const recent = (requestTimestampsByEndpoint.get(endpoint) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = recent[0];
    await sleep(RATE_LIMIT_WINDOW_MS - (now - oldest) + 1);
    return waitForRateLimit(endpoint);
  }
  recent.push(now);
  requestTimestampsByEndpoint.set(endpoint, recent);
}

const MAX_RATE_LIMIT_RETRIES = 3;

// Kimlik bilgileri admin panelinden (Ayarlar > Trendyol) D1'e girildi ve
// etkinleştirildi - getTrendyolCredentials() artık gerçek değerleri
// döndürüyor. TRENDYOL_*_PROD/_STAGE ortam değişkenleri, admin panelinden
// hiç kimlik bilgisi girilmemişse devreye giren yedek yol.
async function trendyolFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; rateLimitKey?: string } = {},
  attempt = 0,
): Promise<T> {
  // Varsayılan anahtar path'in kendisi (query hariç) - ama barkod gibi
  // path'e GÖMÜLÜ değişken bir segment varsa (ör. getProductByBarcode),
  // her çağrı FARKLI bir "endpoint" sayılıp sliding-window limiti hiç
  // devreye girmezdi (her barkod kendi sıfırdan sayacıyla başlardı) -
  // binlerce barkodu art arda tararken Trendyol'u fiilen hiç
  // yavaşlatmadan yağmalayıp gerçek 429'lara çarpardık. Bu durumda
  // çağıran taraf normalize edilmiş, SABİT bir rateLimitKey veriyor.
  const endpoint = init.rateLimitKey ?? path.split("?")[0];
  await waitForRateLimit(endpoint);

  const { supplierId, apiKey, apiSecret } = await getTrendyolCredentials();

  // fetch() burada hiçbir zaman aşımı olmadan çağrılıyordu - Trendyol
  // tarafı bir isteğe yanıt vermeyi geciktirirse (özellikle çok sayfalı
  // getProducts taramasında) tüm istek süresiz askıda kalıp tarayıcıda
  // "donma" gibi görünüyordu. AbortController ile sabit bir üst sınır
  // konuyor.
  const REQUEST_TIMEOUT_MS = 20_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${trendyolApiBase()}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        authorization: buildTrendyolAuthHeader(apiKey, apiSecret),
        // Trendyol, User-Agent header'ı olmayan istekleri 403 ile reddediyor -
        // bu yüzden asla eksik bırakılmamalı.
        "user-agent": buildTrendyolUserAgent(supplierId),
        // Trendyol'un Product V2 API'sinde zorunlu hale gelen header - Türkiye
        // yerel mağazası için "TR" (bkz. developers.trendyol.com Product V2
        // dokümantasyonu, "storeFrontCode" header parametresi).
        "storefrontcode": "TR",
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Trendyol API isteği zaman aşımına uğradı (${REQUEST_TIMEOUT_MS / 1000} sn): ${path}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  // 429: limiti aşan taraf biz olmasak bile (ör. aynı hesabı kullanan başka
  // bir süreç), Retry-After'a (yoksa üstel geri çekilmeye) uyup sınırlı
  // sayıda tekrar deniyoruz - sonsuz döngüye girmemesi için bir tavan var.
  if (response.status === 429) {
    if (attempt >= MAX_RATE_LIMIT_RETRIES) {
      throw new Error(
        "Trendyol API istek limiti aşıldı (429 too.many.requests) - tekrar denemeler tükendi.",
      );
    }
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : 2 ** attempt * 1000;
    await sleep(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 1000);
    return trendyolFetch(path, init, attempt + 1);
  }

  if (!response.ok) {
    let message = await response.text();
    try {
      const parsed = JSON.parse(message) as TrendyolErrorPayload;
      if (parsed.errors?.length) {
        message = parsed.errors
          .map((error) =>
            [error.code, error.message].filter(Boolean).join(": ") || "bilinmeyen hata",
          )
          .join(", ");
      }
    } catch {
      // Trendyol didn't return JSON this time - fall back to the raw body.
    }
    if (response.status === 401) {
      throw new Error(
        `Trendyol kimlik doğrulama hatası (401 ClientApiAuthenticationException): API anahtarlarını kontrol edin. ${message}`,
      );
    }
    if (response.status === 403) {
      throw new Error(
        `Trendyol isteği reddetti (403): User-Agent header eksik veya hatalı olabilir. ${message}`,
      );
    }
    throw new Error(`Trendyol API isteği başarısız (${response.status}): ${message}`);
  }

  return response.json() as Promise<T>;
}

export async function ensureTrendyolColumns(db: D1Database) {
  const columns = await db
    .prepare("PRAGMA table_info(products)")
    .all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("trendyol_barcode")) {
    await db.prepare("ALTER TABLE products ADD COLUMN trendyol_barcode TEXT").run();
  }
  if (!names.has("trendyol_listing_id")) {
    await db.prepare("ALTER TABLE products ADD COLUMN trendyol_listing_id TEXT").run();
  }
  if (!names.has("trendyol_synced_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN trendyol_synced_at TEXT").run();
  }
  if (!names.has("trendyol_price_synced")) {
    await db.prepare("ALTER TABLE products ADD COLUMN trendyol_price_synced INTEGER").run();
  }
  // Site fiyatından (products.price) bağımsız, sadece Trendyol'a giden
  // dinamik fiyat - bkz. lib/trendyol/pricing.ts. Burada da (pricing.ts'in
  // kendi ensure fonksiyonuna ek olarak, döngüsel import olmadan) garanti
  // ediliyor çünkü pushStockAndPriceToTrendyol/pushPendingTrendyolPrices bu
  // kolonu pricing.ts hiç çağrılmamış olsa bile okuyor.
  if (!names.has("trendyol_override_price")) {
    await db.prepare("ALTER TABLE products ADD COLUMN trendyol_override_price INTEGER").run();
  }
  // Onaylı ürün güncelleme servisi (content-bulk-update) barcode değil
  // contentId ile çalışıyor - Trendyol'un getProductByBarcode() ile
  // döndürdüğü, ürüne özel sayısal kimlik. bkz. backfillTrendyolContentIds.
  if (!names.has("trendyol_content_id")) {
    await db.prepare("ALTER TABLE products ADD COLUMN trendyol_content_id INTEGER").run();
  }
  // Bazı ürünler Trendyol'da marka/logo/yasaklı kelime gibi sebeplerle pasife
  // alınıyor, admin bunları Trendyol panelinden elle (kaynak görseli
  // değiştirerek) düzeltiyor. Bu satır doluysa refreshTrendyolImages() (ve
  // ileride eklenecek benzer toplu görsel gönderme araçları) bu ürünü hiç
  // işlemiyor - yoksa D1'deki eski (henüz düzeltilmemiş, tedarikçi
  // kaynaklı) görsel tekrar gönderilip elle yapılan düzeltmenin üzerine
  // yazardı. bkz. /api/admin/products/[id]/lock-trendyol-image.
  if (!names.has("trendyol_image_locked_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN trendyol_image_locked_at TEXT").run();
  }
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS products_trendyol_barcode_unique ON products(trendyol_barcode) WHERE trendyol_barcode IS NOT NULL",
    )
    .run();
}

// --- Product Integration ---
// https://developers.trendyol.com/docs/marketplace/urun-entegrasyonu

export type TrendyolProductAttribute = {
  attributeId: number;
  attributeValueId?: number;
  // allowCustom=true olan özellikler (ör. Renk) için attributeValueId yerine
  // serbest metin gönderilebiliyor (developers.trendyol.com "Kategori Özellik
  // Değerleri Listesi v2").
  customAttributeValue?: string;
};

export type TrendyolProduct = {
  barcode: string;
  title: string;
  productMainId: string;
  brandId: number;
  categoryId: number;
  quantity: number;
  stockCode: string;
  listPrice: number;
  salePrice: number;
  description: string;
  images: { url: string }[];
  vatRate: number;
  cargoCompanyId?: number;
  attributes?: TrendyolProductAttribute[];
};

type TrendyolBatchRequestResult = {
  batchRequestId: string;
};

// UYARI: bu, Trendyol'un artık kapattığı (426 "planlanmış brownout") eski
// v1 ürün listeleme endpoint'i - şu an SADECE missing-products teşhis
// aracında kullanılıyor, o da zaten ayrı, çözülmemiş bir sorun olarak
// biliniyor. Tek ürün/barkod kontrolü için bunun yerine aşağıdaki v2
// getProductByBarcode() kullanılmalı.
export async function getProducts(params: {
  page?: number;
  size?: number;
  barcode?: string;
} = {}): Promise<{ content: TrendyolProduct[]; totalElements: number; totalPages: number }> {
  const { supplierId } = await getTrendyolCredentials();
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  if (params.barcode) query.set("barcode", params.barcode);
  const search = query.toString();
  return trendyolFetch(
    `/product/sellers/${supplierId}/products${search ? `?${search}` : ""}`,
  );
}

export type TrendyolProductFilterInfo = {
  barcode: string;
  approved: boolean;
  approvedDate?: number | null;
  archived: boolean;
  contentId: number;
  listingId: string;
};

// Trendyol "Ürün Filtreleme - Temel Bilgi v2" (Product Filter - Base
// Information v2) servisi - tek bir barkodun Trendyol'da GERÇEKTEN var/
// onaylı olup olmadığını (approved, approvedDate, archived, listingId,
// contentId gibi alanlarla) döndürüyor. getProducts() (v1, brownout'ta)
// yerine bunu kullan.
export async function getProductByBarcode(barcode: string): Promise<TrendyolProductFilterInfo> {
  const { supplierId } = await getTrendyolCredentials();
  return trendyolFetch(
    `/product/sellers/${supplierId}/product/${encodeURIComponent(barcode)}`,
    { rateLimitKey: `/product/sellers/${supplierId}/product/:barcode` },
  );
}

export type TrendyolUnapprovedProduct = {
  barcode: string;
  title: string;
  brand?: string;
  category?: string;
  status: string; // "rejected" | "pendingApproval"
  rejectReason?: string;
  rejectReasonDetail?: string;
  createDateTime?: number;
  lastUpdateDate?: number;
};

// Trendyol "Ürün Filtreleme - Onaysız Ürün v2" (Product Filter - Unapproved
// Product v2) servisi - reddedilmiş/onay bekleyen ürünleri, RED SEBEBİYLE
// (rejectReason/rejectReasonDetail) birlikte döndürüyor. 200 ürünün marka/
// logo yüzünden pasife alınma sebebini teşhis etmek için kullanılıyor -
// salt-okunur, hiçbir şeyi değiştirmiyor.
export async function getUnapprovedProducts(params: {
  page?: number;
  size?: number;
} = {}): Promise<{
  content: TrendyolUnapprovedProduct[];
  totalElements: number;
  totalPages: number;
}> {
  const { supplierId } = await getTrendyolCredentials();
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const search = query.toString();
  return trendyolFetch(
    `/product/sellers/${supplierId}/products/unapproved${search ? `?${search}` : ""}`,
  );
}

export type TrendyolCategory = {
  id: number;
  name: string;
  parentId: number | null;
  subCategories: TrendyolCategory[];
};

// Seller'a özel değil, Trendyol'un tüm kategori ağacını döner - ürün
// gönderirken gereken categoryId'yi bulmak için kullanılıyor
// (developers.trendyol.com "Trendyol Kategori Listesi - getCategoryTree").
// name verilirse Trendyol o kelimeyi içeren kategorileri (her seviyede)
// filtreleyip döner.
export async function getCategories(name?: string): Promise<TrendyolCategory[]> {
  const search = name ? `?name=${encodeURIComponent(name)}` : "";
  const result = await trendyolFetch<{ categories: TrendyolCategory[] }>(
    `/product/product-categories${search}`,
  );
  return result.categories;
}

// Kategori ağacını düz bir listeye çevirir (id + tam yol) - admin panelinde
// aranabilir hâle getirmek için.
export function flattenTrendyolCategories(
  categories: TrendyolCategory[],
  parentPath = "",
): { id: number; path: string }[] {
  return categories.flatMap((category) => {
    const path = parentPath ? `${parentPath} > ${category.name}` : category.name;
    return [
      { id: category.id, path },
      ...flattenTrendyolCategories(category.subCategories, path),
    ];
  });
}

export type TrendyolCategoryAttribute = {
  categoryId: number;
  attribute: { id: number; name: string };
  required: boolean;
  allowCustom: boolean;
  attributeValues?: { id: number; name: string }[];
};

// Bir kategorinin zorunlu/opsiyonel özelliklerini (ör. Renk, Materyal)
// döner (developers.trendyol.com "Category Attribute List v2"). Ürün
// gönderirken bu özelliklerden required=true olanlar attributes alanında
// gönderilmezse Trendyol isteği reddediyor - 500 hatasının olası
// nedenlerinden biri bu eksik alan olabilir.
//
// NOT: Bu, getCategories()'in kullandığı "product-categories" (kategori
// AĞACI, hâlâ geçerli) ile AYNI segment DEĞİL - sadece bu attributes
// endpoint'i v2'de "categories" olarak yeniden adlandırıldı. Eski
// "/product/product-categories/{id}/attributes" (v1) artık planlanmış bir
// brownout nedeniyle 426 döndürüyor ("bu endpoint geçici olarak
// kullanılamıyor, Product v2'ye taşıyın" mesajıyla) - developers.trendyol.com
// "Category Attribute List v2" dokümantasyonuna göre doğru yol
// "/product/categories/{id}/attributes".
export async function getCategoryAttributes(
  categoryId: number,
): Promise<TrendyolCategoryAttribute[]> {
  const result = await trendyolFetch<{
    categoryAttributes: TrendyolCategoryAttribute[];
  }>(`/product/categories/${categoryId}/attributes`);
  return result.categoryAttributes ?? [];
}

// Geçici teşhis yardımcısı: attributeValues eşlememizin (getCategoryAttributes)
// doğru olup olmadığını doğrulamak için Trendyol'un işlenmemiş yanıtını
// olduğu gibi döner.
export async function getCategoryAttributesRaw(categoryId: number): Promise<unknown> {
  return trendyolFetch(`/product/categories/${categoryId}/attributes`);
}

export type TrendyolCategoryAttributeValue = {
  attributeValueId: number;
  attributeValue: string;
};

type TrendyolAttributeValuesPage = {
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  content: TrendyolCategoryAttributeValue[];
};

// getCategoryAttributes() sadece özelliklerin adını/zorunluluğunu döner,
// gerçek değerler ("Kadın"/"Erkek" gibi) AYRI bir sayfalı servisten geliyor
// (developers.trendyol.com "Kategori Özellik Değerleri Listesi v2") -
// allowCustom=false olan zorunlu özellikler (Cinsiyet, Materyal, Beden vb.)
// için ürün gönderirken geçerli bir attributeValueId burada bulunmalı.
export async function getCategoryAttributeValues(
  categoryId: number,
  attributeId: number,
): Promise<TrendyolCategoryAttributeValue[]> {
  const values: TrendyolCategoryAttributeValue[] = [];
  let page = 0;
  // Güvenlik için tavan - hiçbir zorunlu özelliğin binlerce değeri olmaz,
  // sonsuz döngüye karşı bir sınır.
  const MAX_PAGES = 20;
  while (page < MAX_PAGES) {
    const result = await trendyolFetch<TrendyolAttributeValuesPage>(
      `/product/categories/${categoryId}/attributes/${attributeId}/values?page=${page}&size=100`,
    );
    values.push(...(result.content ?? []));
    if (page >= (result.totalPages ?? 1) - 1) break;
    page += 1;
  }
  return values;
}

// Geçici teşhis yardımcısı: yukarıdaki eşlememizi doğrulamak için Trendyol'un
// bir özellik değeri sayfasının işlenmemiş yanıtını olduğu gibi döner.
export async function getCategoryAttributeValuesRaw(
  categoryId: number,
  attributeId: number,
): Promise<unknown> {
  return trendyolFetch(
    `/product/categories/${categoryId}/attributes/${attributeId}/values?page=0&size=100`,
  );
}

export type TrendyolBrand = {
  id: number;
  name: string;
};

// Trendyol markasız ürün kabul etmiyor - her ürün için geçerli bir brandId
// gerekiyor (developers.trendyol.com "Trendyol Marka Listesi - getBrands").
// name ile arama yapıldığında sadece o kelimeyi içeren markalar dönüyor
// (ör. "Genel Markalar" gibi kayıtlı markası olmayan satıcılar için
// kullanılabilecek genel kategoriler).
export async function getBrandsByName(name: string): Promise<TrendyolBrand[]> {
  // Trendyol'un bu servisin tam yanıt zarfını (categories gibi { brands: [] }
  // mı, yoksa doğrudan [] mi döndürdüğünü) dokümantasyonda net
  // doğrulayamadık - ikisini de kabul edecek şekilde yazıldı.
  const result = await trendyolFetch<TrendyolBrand[] | { brands: TrendyolBrand[] }>(
    `/product/brands/by-name?name=${encodeURIComponent(name)}`,
  );
  return Array.isArray(result) ? result : (result.brands ?? []);
}

export async function createProduct(
  products: TrendyolProduct[],
): Promise<TrendyolBatchRequestResult> {
  const { supplierId } = await getTrendyolCredentials();
  return trendyolFetch(`/product/sellers/${supplierId}/v2/products`, {
    method: "POST",
    body: { items: products },
  });
}

// v2/products (create ile aynı endpoint) sadece HENÜZ ONAYLANMAMIŞ ürünler
// için barcode ile güncelleme yapıyor ("Ürün Güncelleme - Onaysız Ürün v2").
// Trendyol'da ONAYLANMIŞ ürünler için ayrı, contentId ile çalışan bir servis
// var (Ürün Güncelleme - Onaylı Ürün v2, bkz. updateProductImages) - bu
// yüzden PUT/POST denemesi fark etmeksizin bu endpoint'ten aynı 404 alındı:
// içerik zaten onaylıysa bu endpoint uygun endpoint değil.
export async function updateProduct(
  products: TrendyolProduct[],
): Promise<TrendyolBatchRequestResult> {
  const { supplierId } = await getTrendyolCredentials();
  return trendyolFetch(`/product/sellers/${supplierId}/v2/products`, {
    method: "POST",
    body: { items: products },
  });
}

export type TrendyolProductContentUpdate = {
  contentId: number;
  images: { url: string }[];
};

// Trendyol "Ürün Güncelleme - Onaylı Ürün v2" servisi - ONAYLANMIŞ
// ürünlerde barcode değil contentId ile eşleştirme yapıyor, ayrı bir
// endpoint'te (content-bulk-update). updateProduct()'ın kullandığı
// /v2/products (barcode ile) sadece henüz onaylanmamış ürünlerde işe
// yarıyor - onaylı üründe "İşlem başarısız oldu" (404) ile reddediliyordu,
// kök neden hem yanlış endpoint hem yanlış eşleştirme alanıydı (barcode
// yerine contentId gerekiyordu). contentId, getProductByBarcode() ile
// bulunup trendyol_content_id kolonuna yazılıyor (bkz.
// backfillTrendyolContentIds). Sadece fotoğraf güncellemek için
// updateProduct()'ın TAM ürün objesine gerek yok - kısmi (partial) payload
// yeterli: contentId + images.
export async function updateProductImages(
  items: TrendyolProductContentUpdate[],
): Promise<TrendyolBatchRequestResult> {
  const { supplierId } = await getTrendyolCredentials();
  return trendyolFetch(`/product/sellers/${supplierId}/products/content-bulk-update`, {
    method: "POST",
    body: { items },
  });
}

// --- Price & Inventory Integration ---
// https://developers.trendyol.com/docs/marketplace/fiyat-ve-stok-entegrasyonu

export type TrendyolPriceAndInventoryItem = {
  barcode: string;
  quantity: number;
  salePrice: number;
  listPrice: number;
};

// D1 tek gerçek kaynak (source of truth) - stok/fiyat her zaman D1'den
// Trendyol'a tek yönlü gönderilir, Shopify entegrasyonundaki
// pushInventoryToShopify/pushPriceToShopify ile aynı prensip (bkz.
// lib/shopify/inventory.ts, lib/shopify/price.ts). Trendyol tarafında
// yapılan bir değişiklik hiçbir zaman D1'e geri okunmaz.
export async function updateStockAndPrice(
  items: TrendyolPriceAndInventoryItem[],
): Promise<TrendyolBatchRequestResult> {
  const { supplierId } = await getTrendyolCredentials();
  return trendyolFetch(
    `/inventory/sellers/${supplierId}/products/price-and-inventory`,
    { method: "POST", body: { items } },
  );
}

export async function getBatchRequestResult(batchRequestId: string): Promise<{
  batchRequestId: string;
  items: { status: string; failureReasons?: string[] }[];
}> {
  const { supplierId } = await getTrendyolCredentials();
  return trendyolFetch(
    `/product/sellers/${supplierId}/products/batch-requests/${batchRequestId}`,
  );
}

// --- Order Integration ---
// https://developers.trendyol.com/docs/marketplace/siparis-entegrasyonu

export type TrendyolOrderLine = {
  barcode: string;
  productName: string;
  quantity: number;
  price: number;
  productId?: number;
};

export type TrendyolOrderPackage = {
  shipmentPackageId: number;
  orderNumber: string;
  status: string;
  grossAmount: number;
  totalDiscount: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  orderDate: number;
  cargoTrackingNumber?: number;
  shipmentAddress?: {
    address1?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
    phone?: string;
  };
  lines: TrendyolOrderLine[];
};

export async function getOrders(params: {
  startDate?: number;
  endDate?: number;
  status?: string;
  page?: number;
  size?: number;
} = {}): Promise<{ content: TrendyolOrderPackage[]; totalElements: number; totalPages: number }> {
  const { supplierId } = await getTrendyolCredentials();
  const query = new URLSearchParams();
  if (params.startDate !== undefined) query.set("startDate", String(params.startDate));
  if (params.endDate !== undefined) query.set("endDate", String(params.endDate));
  if (params.status) query.set("status", params.status);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const search = query.toString();
  return trendyolFetch(`/order/sellers/${supplierId}/orders${search ? `?${search}` : ""}`);
}

// Terragolds admin, kargo durumunu değiştirebileceğimiz TEK yer - Shopify
// entegrasyonundaki fulfillShopifyOrder ile aynı "geri okuma yok" kuralı:
// bu sadece Trendyol'a kargoya verildi bilgisini tek yönlü bildirir, oradan
// asla bir durum D1'e geri çekilmez (yeni sipariş içeriği hariç, bkz.
// lib/trendyol/orders.ts).
export async function updateOrderStatus(
  shipmentPackageId: number,
  input: { status: "Shipped" | "Delivered"; trackingNumber?: string; cargoProviderName?: string },
): Promise<void> {
  const { supplierId } = await getTrendyolCredentials();
  await trendyolFetch(
    `/order/sellers/${supplierId}/shipment-packages/${shipmentPackageId}`,
    {
      method: "PUT",
      body: {
        status: input.status,
        trackingNumber: input.trackingNumber,
        cargoProviderName: input.cargoProviderName,
      },
    },
  );
}
