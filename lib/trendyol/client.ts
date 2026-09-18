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
  init: { method?: string; body?: unknown } = {},
  attempt = 0,
): Promise<T> {
  const endpoint = path.split("?")[0];
  await waitForRateLimit(endpoint);

  const { supplierId, apiKey, apiSecret } = await getTrendyolCredentials();

  const response = await fetch(`${trendyolApiBase()}${path}`, {
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
  });

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
          .map((error) => error.message ?? error.code ?? "bilinmeyen hata")
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
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS products_trendyol_barcode_unique ON products(trendyol_barcode) WHERE trendyol_barcode IS NOT NULL",
    )
    .run();
}

// --- Product Integration ---
// https://developers.trendyol.com/docs/marketplace/urun-entegrasyonu

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
};

type TrendyolBatchRequestResult = {
  batchRequestId: string;
};

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
  attributeValues: { id: number; name: string }[];
};

// Bir kategorinin zorunlu/opsiyonel özelliklerini (ör. Renk, Materyal)
// döner (developers.trendyol.com "Kategori Özellik Listesi v2"). Ürün
// gönderirken bu özelliklerden required=true olanlar attributes alanında
// gönderilmezse Trendyol isteği reddediyor - 500 hatasının olası
// nedenlerinden biri bu eksik alan olabilir.
export async function getCategoryAttributes(
  categoryId: number,
): Promise<TrendyolCategoryAttribute[]> {
  const result = await trendyolFetch<{
    categoryAttributes: TrendyolCategoryAttribute[];
  }>(`/product/categories/${categoryId}/attributes`);
  return result.categoryAttributes ?? [];
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

export async function updateProduct(
  products: TrendyolProduct[],
): Promise<TrendyolBatchRequestResult> {
  const { supplierId } = await getTrendyolCredentials();
  // Trendyol'da ürün güncellemesi de aynı v2/products endpoint'i üzerinden,
  // PUT metoduyla ve barcode eşleştirmesiyle yapılıyor - ayrı bir "update"
  // endpoint'i yok.
  return trendyolFetch(`/product/sellers/${supplierId}/v2/products`, {
    method: "PUT",
    body: { items: products },
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
