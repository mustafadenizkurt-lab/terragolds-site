import { getHepsiburadaCredentials, buildHepsiburadaAuthHeader, buildHepsiburadaUserAgent } from "./auth";
import {
  HEPSIBURADA_LISTING_API_BASE,
  HEPSIBURADA_ORDER_API_BASE,
  HEPSIBURADA_PRODUCT_API_BASE,
} from "./client";
import { applyHepsiburadaEnvironment } from "./http-utils";

// Hepsiburada test (SIT) sürecinin resmi adımlarını (katalog, listeleme,
// sipariş) çalıştıran ham çağrılar. Uç noktalar developers.hepsiburada.com
// referans sayfalarından birebir alındı. GÜVENLİK: yalnızca kimlik
// bilgilerindeki ortam "test" ise çalışır - canlı mağazaya asla istek atmaz.

export type SitCallResult = {
  step: string;
  method: string;
  url: string;
  status: number;
  body: unknown;
};

const KIND_BASE = {
  product: HEPSIBURADA_PRODUCT_API_BASE,
  listing: HEPSIBURADA_LISTING_API_BASE,
  order: HEPSIBURADA_ORDER_API_BASE,
} as const;

async function sitCall(
  step: string,
  kind: keyof typeof KIND_BASE,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
): Promise<SitCallResult> {
  const { merchantId, secretKey, integratorName, environment } = await getHepsiburadaCredentials();
  if (environment?.trim().toLowerCase() !== "test") {
    throw new Error("SIT test adımları yalnızca ortam 'test' iken çalışır (canlı mağazaya istek atılmaz).");
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const resolvedPath = path.replaceAll("{merchantId}", merchantId);
  const url = `${applyHepsiburadaEnvironment(KIND_BASE[kind], environment)}${resolvedPath}${
    query.toString() ? `?${query.toString()}` : ""
  }`;
  const response = await fetch(url, {
    method,
    headers: {
      authorization: buildHepsiburadaAuthHeader(merchantId, secretKey),
      "user-agent": buildHepsiburadaUserAgent(integratorName),
      accept: "application/json",
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let body: unknown = text.slice(0, 4000);
  try {
    body = JSON.parse(text);
  } catch {
    // JSON olmayan yanıt (ör. Cloudflare 520 metni) ham metinle döner.
  }
  return { step, method, url: url.replace(merchantId, "{merchantId}"), status: response.status, body };
}

type Sku = { hepsiburadaSku?: string; merchantSku?: string };

// Adım adı -> çalıştırıcı. Hepsi resmi test rehberlerindeki zorunlu adımlar.
export async function runSitStep(
  step: string,
  params: Record<string, unknown> = {},
): Promise<SitCallResult> {
  const { merchantId } = await getHepsiburadaCredentials();
  const skus = (params.skus as string[] | undefined) ?? [];
  const items = (params.items as Sku[] | undefined) ?? [];
  const id = String(params.id ?? "");
  const sku = String(params.sku ?? "");
  const merchantSku = String(params.merchantSku ?? "");
  const productPaths = "/product/api/products";
  const listing = "/listings/merchantid/{merchantId}";

  switch (step) {
    // --- Katalog ---
    case "product.approve-prematch":
      return sitCall(step, "product", "POST", `${productPaths}/approve-prematch`, {
        body: { merchant: merchantId, merchantSkuList: skus },
      });
    case "product.reject-prematch":
      return sitCall(step, "product", "POST", `${productPaths}/reject-prematch`, {
        body: { merchant: merchantId, merchantSkuList: skus },
      });
    case "product.check-status":
      return sitCall(step, "product", "POST", `${productPaths}/check-product-status`, {
        query: { version: 1 },
        body: { merchant: merchantId, merchantSkuList: skus },
      });
    case "product.by-status":
      return sitCall(step, "product", "GET", `${productPaths}/products-by-merchant-and-status`, {
        query: {
          merchantId,
          productStatus: String(params.productStatus ?? "PRE_MATCHED"),
          taskStatus: params.taskStatus === undefined ? undefined : String(params.taskStatus),
          version: 1,
          page: 0,
          size: 100,
        },
      });
    case "product.merchant-products":
      return sitCall(step, "product", "GET", `${productPaths}/all-products-of-merchant/{merchantId}`, {
        query: { page: 0, size: 100 },
      });
    case "product.tracking-history":
      return sitCall(step, "product", "GET", `${productPaths}/trackingId-history`, {
        query: { version: 1, page: 0, size: 20 },
      });
    case "product.delete-process":
      return sitCall(step, "product", "POST", `${productPaths}/delete-process`, {
        body: { merchant: merchantId, merchantSku },
      });
    case "product.delete-process-status":
      return sitCall(step, "product", "GET", `${productPaths}/delete-process/${encodeURIComponent(id)}`);
    case "product.fastlisting":
      return sitCall(step, "product", "POST", `${productPaths}/fastlisting`, {
        body: {
          merchant: merchantId,
          merchantSku,
          productName: String(params.productName ?? ""),
          barcode: String(params.barcode ?? ""),
        },
      });

    // --- Listeleme ---
    case "listing.query":
      return sitCall(step, "listing", "GET", listing, { query: { offset: 0, limit: 10 } });
    case "listing.price":
      return sitCall(step, "listing", "POST", `${listing}/price-uploads`, { body: items });
    case "listing.price-status":
      return sitCall(step, "listing", "GET", `${listing}/price-uploads/id/${encodeURIComponent(id)}`);
    case "listing.stock":
      return sitCall(step, "listing", "POST", `${listing}/stock-uploads`, { body: items });
    case "listing.stock-status":
      return sitCall(step, "listing", "GET", `${listing}/stock-uploads/id/${encodeURIComponent(id)}`);
    case "listing.inventory":
      return sitCall(step, "listing", "POST", `${listing}/inventory-uploads`, { body: items });
    case "listing.inventory-status":
      return sitCall(step, "listing", "GET", `${listing}/inventory-uploads/id/${encodeURIComponent(id)}`);
    case "listing.activate":
      return sitCall(step, "listing", "POST", `${listing}/sku/${encodeURIComponent(sku)}/activate`);
    case "listing.deactivate":
      return sitCall(step, "listing", "POST", `${listing}/sku/${encodeURIComponent(sku)}/deactivate`);
    case "listing.bulk-unlock":
      return sitCall(step, "listing", "POST", `${listing}/bulk-unlock`, {
        body: { hbSkuList: skus },
      });

    // --- Sipariş (sunucu 520 olduğu sürece doğrulanamaz) ---
    case "order.list-paid":
      return sitCall(step, "order", "GET", "/orders/merchantid/{merchantId}", {
        query: { offset: 0, limit: 10 },
      });
    case "order.list-packages":
      return sitCall(step, "order", "GET", "/packages/merchantid/{merchantId}", {
        query: { offset: 0, limit: 10 },
      });
    default:
      throw new Error(`Bilinmeyen SIT adımı: ${step}`);
  }
}
