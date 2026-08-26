const MAX_FEED_BYTES = 10 * 1024 * 1024;

export async function fetchFeed(feedUrl: string, signal?: AbortSignal) {
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    throw new Error("Geçerli bir XML URL'si girilmelidir.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("XML URL'si yalnızca HTTP veya HTTPS olabilir.");
  }

  const response = await fetch(url, {
    signal,
    headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
  });
  if (!response.ok) throw new Error(`XML akışı alınamadı (HTTP ${response.status}).`);

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FEED_BYTES) throw new Error("XML akışı 10 MB sınırını aşıyor.");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_FEED_BYTES) {
    throw new Error("XML akışı 10 MB sınırını aşıyor.");
  }
  return text;
}
