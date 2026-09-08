// Terragolds Sync uygulamasının Client ID/Secret'ının doğru çalıştığını
// test eder - access_token'ı EKRANA YAZDIRMAZ, sadece bağlantının başarılı
// olup olmadığını ve dönen scope/expires_in bilgisini gösterir.
//
// Kullanım:
//   export SHOPIFY_CLIENT_ID="..."
//   read -s SHOPIFY_CLIENT_SECRET && export SHOPIFY_CLIENT_SECRET
//   node scripts/shopify-test-token.mjs

const SHOP_DOMAIN = "x9aqw8-c0.myshopify.com";

const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "SHOPIFY_CLIENT_ID ve/veya SHOPIFY_CLIENT_SECRET ortam değişkeni ayarlanmamış.",
  );
  process.exit(1);
}

const response = await fetch(
  `https://${SHOP_DOMAIN}/admin/oauth/access_token`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  },
);

const body = await response.json();

if (!response.ok || !body.access_token) {
  console.error(`Başarısız (HTTP ${response.status}):`, JSON.stringify(body));
  process.exit(1);
}

console.log("✅ Bağlantı başarılı.");
console.log("scope:", body.scope);
console.log("expires_in:", body.expires_in, "saniye (~24 saat)");
console.log(
  "Not: token bu ekrana yazdırılmadı. Kalıcı kurulum için CLIENT_ID/SECRET'ı",
  "'wrangler secret put' ile saklıyoruz - worker kodu token'ı kendisi tazeler.",
);
