// Cloudflare Workers'tan Hepsiburada'nın (kendisi de Cloudflare arkasında)
// bazı uç noktalarına - özellikle sipariş/oms-external - atılan istekler 520
// ile dönüyor: bilinen bir Cloudflare Workers -> Cloudflare origin
// bot-koruması çakışması. Bu servis, isteği normal bir sunucu IP'sinden
// (Render) yeniden atan ince bir vekil - sadece yetkili (paylaşılan sır
// bilen) ve yalnızca Hepsiburada'nın bilinen host'larına giden istekleri
// kabul eder, başka hiçbir şey yapmaz.
//
// Sözleşme: istemci (terragolds-site Worker'ı, bkz. lib/hepsiburada/
// client.ts'teki hepsiburadaRawFetch) POST /forward'a, gerçek Hepsiburada
// isteğinin tüm header'larını (authorization, user-agent, content-type,
// vb.) ve gövdesini AYNEN taşıyarak istek atar; asıl hedef URL/method ayrıca
// x-target-url/x-target-method header'larında, kimlik doğrulama da
// x-proxy-secret header'ında gelir. Bu servis x-proxy-secret'ı doğrular,
// kendi yönlendirme header'larını (x-proxy-secret, x-target-url,
// x-target-method, host, content-length) çıkarıp geri kalan her şeyi
// olduğu gibi hedefe iletir ve yanıtı da olduğu gibi geri döner.
const http = require("http");

const PORT = process.env.PORT || 3000;
const PROXY_SECRET = process.env.PROXY_SECRET;

const ALLOWED_HOSTS = new Set([
  "mpop.hepsiburada.com",
  "mpop-sit.hepsiburada.com",
  "listing-external.hepsiburada.com",
  "listing-external-sit.hepsiburada.com",
  "oms-external.hepsiburada.com",
  "oms-external-sit.hepsiburada.com",
]);

// Bu servise özel yönlendirme header'ları + hedefe taşınması anlamsız/yanlış
// olacak hop-by-hop header'lar (content-length yeni gövdeye göre yeniden
// hesaplanır, accept-encoding hedefin bize vs bizim hedefe sıkıştırma
// anlaşmasını karıştırmasın diye bırakılır - undici kendi tercihini koyar).
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "x-proxy-secret",
  "x-target-url",
  "x-target-method",
  "accept-encoding",
]);

const STRIP_RESPONSE_HEADERS = new Set(["content-encoding", "transfer-encoding", "connection"]);

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.url !== "/forward") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }

  if (!PROXY_SECRET) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("PROXY_SECRET ortam değişkeni ayarlanmamış");
    return;
  }
  if (req.headers["x-proxy-secret"] !== PROXY_SECRET) {
    res.writeHead(401, { "content-type": "text/plain" });
    res.end("unauthorized");
    return;
  }

  const targetUrlHeader = req.headers["x-target-url"];
  const targetMethod = String(req.headers["x-target-method"] || req.method || "GET").toUpperCase();

  let targetUrl;
  try {
    targetUrl = new URL(String(targetUrlHeader));
  } catch {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("geçersiz x-target-url");
    return;
  }
  if (targetUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(targetUrl.hostname)) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("hedef host izinli değil");
    return;
  }

  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (STRIP_REQUEST_HEADERS.has(key.toLowerCase()) || value === undefined) continue;
    forwardHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  const hasBody = targetMethod !== "GET" && targetMethod !== "HEAD";
  const body = hasBody ? await readRequestBody(req) : undefined;

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: targetMethod,
      headers: forwardHeaders,
      body,
    });
  } catch (error) {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`vekil iletim hatası: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    return;
  }

  const responseBuffer = Buffer.from(await upstream.arrayBuffer());
  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
    responseHeaders[key] = value;
  });
  res.writeHead(upstream.status, responseHeaders);
  res.end(responseBuffer);
});

server.listen(PORT, () => {
  console.log(`hepsiburada-proxy ${PORT} portunda dinliyor`);
});
