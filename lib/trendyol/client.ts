import { getTrendyolCredentials, buildTrendyolAuthHeader, buildTrendyolUserAgent } from "./auth";

// Trendyol Marketplace'in resmi entegrasyon dokümantasyonundaki temel URL -
// https://developers.trendyol.com. Sandbox/stage için ayrı bir host var
// (stageapigw.trendyol.com) ama onay süreci bitene kadar hangisinin
// kullanılacağı netleşmeyecek, o yüzden şimdilik canlı host sabitlendi.
export const TRENDYOL_API_BASE = "https://apigw.trendyol.com/integration";

type TrendyolErrorPayload = {
  errors?: { message?: string; code?: string }[];
};

// NOT: TRENDYOL_SUPPLIER_ID/API_KEY/API_SECRET henüz .env'de/Worker secret
// olarak tanımlı değil (Trendyol onayı bekleniyor) - bu yüzden bu dosyadaki
// hiçbir fonksiyon şu an gerçekten çalıştırılamaz; her çağrı
// getTrendyolCredentials() üzerinden "ortam değişkeni ayarlanmamış" hatasıyla
// başarısız olur. Onay gelip secret'lar eklendiğinde kod değişikliği
// gerekmeden çalışır hale gelecek.
async function trendyolFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { supplierId, apiKey, apiSecret } = await getTrendyolCredentials();

  const response = await fetch(`${TRENDYOL_API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      authorization: buildTrendyolAuthHeader(apiKey, apiSecret),
      "user-agent": buildTrendyolUserAgent(supplierId),
      // Trendyol'un Product V2 API'sinde zorunlu hale gelen header - Türkiye
      // yerel mağazası için "TR" (bkz. developers.trendyol.com Product V2
      // dokümantasyonu, "storeFrontCode" header parametresi).
      "storefrontcode": "TR",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

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
