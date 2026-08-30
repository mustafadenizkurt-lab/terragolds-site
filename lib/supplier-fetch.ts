// Shared HTTP client for pulling supplier XML feeds (both the one-off admin
// import and the scheduled XML sync use this). Many supplier feeds sit
// behind a CDN/WAF that rejects bare server-to-server requests — no
// User-Agent, no Accept-Language — as bot traffic, or return a transient
// Cloudflare gateway error (520-527) that clears up on retry. A browser-like
// request plus a short retry loop fixes both without needing a proxy.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const RETRYABLE_STATUSES = new Set([
  429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527,
]);

/** Terminal failure — retrying would not help (bad status, body too large). */
class NonRetryableError extends Error {}
/** Transient failure — worth another attempt. */
class RetryableError extends Error {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FetchSupplierXmlOptions = {
  signal?: AbortSignal;
  /** Reject if the body is larger than this many bytes. */
  maxBytes: number;
  /** Per-attempt timeout in ms. Default 20s. */
  timeoutMs?: number;
  /** Extra attempts after the first. Default 2. */
  retries?: number;
};

/**
 * Fetches a supplier XML feed as text, with browser-like headers, redirect
 * following, a per-attempt timeout, and retries for transient gateway
 * errors/network failures.
 */
export async function fetchSupplierXmlText(
  url: string,
  options: FetchSupplierXmlOptions,
): Promise<string> {
  const { signal, maxBytes, timeoutMs = 20000, retries = 2 } = options;
  let lastMessage = "XML alınamadı.";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          accept: "application/xml, text/xml, */*;q=0.8",
          "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "user-agent": BROWSER_USER_AGENT,
        },
      });

      if (!response.ok) {
        const rayId = response.headers.get("cf-ray");
        const message = `XML alınamadı (HTTP ${response.status}${rayId ? `, cf-ray: ${rayId}` : ""}).`;
        throw RETRYABLE_STATUSES.has(response.status)
          ? new RetryableError(message)
          : new NonRetryableError(message);
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > maxBytes) {
        throw new NonRetryableError("XML dosyası boyut sınırını aşıyor.");
      }

      // Read as bytes first so the size check doesn't need to decode to text
      // and then re-encode a second full copy just to measure it - large
      // feeds were briefly held in memory three times over (raw bytes, the
      // decoded string, and the re-encoded check) for no reason.
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        throw new NonRetryableError("XML dosyası boyut sınırını aşıyor.");
      }
      return new TextDecoder("utf-8").decode(buffer);
    } catch (error) {
      if (error instanceof NonRetryableError) throw error;
      if (error instanceof RetryableError) {
        lastMessage = error.message;
      } else {
        const isAbort = error instanceof Error && error.name === "AbortError";
        lastMessage = isAbort
          ? "XML kaynağına bağlanılamadı (zaman aşımı)."
          : `XML kaynağına bağlanılamadı (${error instanceof Error ? error.message : String(error)}).`;
      }
      if (attempt < retries) {
        await sleep(attempt === 0 ? 500 : 1500);
        continue;
      }
      throw new Error(lastMessage);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  throw new Error(lastMessage);
}
