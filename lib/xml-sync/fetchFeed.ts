import { fetchSupplierXmlText } from "../supplier-fetch";

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

  return fetchSupplierXmlText(url.toString(), {
    signal,
    maxBytes: MAX_FEED_BYTES,
  });
}
