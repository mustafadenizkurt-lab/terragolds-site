const http = require("node:http");

// Hepsiburada'nın sipariş/listeleme sunucuları, Cloudflare Workers'tan
// (terragolds.com'un barındığı yer) gelen istekleri 520 ile engelliyor.
// Bu servis, Render.com gibi Cloudflare dışı bir ağdan isteği Hepsiburada'ya
// ileten amaca özel, dar kapsamlı bir köprüdür - genel bir "herhangi bir
// URL'ye yönlendir" açık proxy'si DEĞİL: hem hedef URL hem de iletilen
// header'lar sabit, kapalı listelerle sınırlı (bkz. ALLOWED_URL_PATTERNS,
// ALLOWED_REQUEST_HEADERS). Hepsiburada kimlik bilgilerini kendisi saklamaz,
// Worker'ın gönderdiği Authorization/User-Agent header'larını olduğu gibi
// yalnızca izin verilen Hepsiburada uç noktalarına iletir.

const PROXY_SECRET = process.env.PROXY_SECRET;
if (!PROXY_SECRET) {
  throw new Error("PROXY_SECRET ortam değişkeni zorunludur.");
}

// Kasıtlı olarak dar: genel bir "herhangi bir URL'ye yönlendir" açık köprüsü
// DEĞİL - sadece bizim gerçekten kullandığımız, sabit Hepsiburada sipariş/
// listeleme uç nokta kalıplarına izin veren kapalı bir liste. Başka hiçbir
// host veya yol bu servis üzerinden çağrılamaz.
const ALLOWED_URL_PATTERNS = [
  /^https:\/\/oms-external(-sit)?\.hepsiburada\.com\/orders\/merchantid\/[A-Za-z0-9-]+(\?.*)?$/,
  /^https:\/\/oms-external(-sit)?\.hepsiburada\.com\/packages\/merchantid\/[A-Za-z0-9-]+(\?.*)?$/,
  /^https:\/\/oms-external(-sit)?\.hepsiburada\.com\/Shipment\/Package\/[A-Za-z0-9-]+$/,
  /^https:\/\/listing-external(-sit)?\.hepsiburada\.com\/listings\/merchantid\/[A-Za-z0-9-]+(\/[A-Za-z0-9/_-]*)?(\?.*)?$/,
];

function isAllowedUrl(url) {
  return ALLOWED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);
const ALLOWED_REQUEST_HEADERS = new Set([
  "authorization",
  "user-agent",
  "accept",
  "accept-language",
  "accept-encoding",
  "content-type",
]);

function sanitizeHeaders(headers) {
  const result = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (ALLOWED_REQUEST_HEADERS.has(key.toLowerCase()) && typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.method !== "POST" || req.url !== "/relay") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (req.headers["x-proxy-secret"] !== PROXY_SECRET) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw);
    const { method, url, headers, body } = payload;

    if (typeof url !== "string" || !isAllowedUrl(url)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "bu yol izin verilen Hepsiburada uç noktaları arasında değil" }));
      return;
    }
    const resolvedMethod = typeof method === "string" ? method.toUpperCase() : "GET";
    if (!ALLOWED_METHODS.has(resolvedMethod)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "izin verilmeyen HTTP metodu" }));
      return;
    }

    const upstream = await fetch(url, {
      method: resolvedMethod,
      headers: sanitizeHeaders(headers),
      body: body !== undefined && body !== null ? body : undefined,
    });
    const text = await upstream.text();
    const upstreamHeaders = {};
    upstream.headers.forEach((value, key) => {
      upstreamHeaders[key] = value;
    });

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: upstream.status, headers: upstreamHeaders, body: text }));
  } catch (error) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "bilinmeyen hata" }));
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`hepsiburada-proxy listening on ${port}`);
});
