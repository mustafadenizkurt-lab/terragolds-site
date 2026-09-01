#!/usr/bin/env node
// Bülten (newsletter) formunun gönderdiği e-postanın gerçekten
// veritabanına yazılıp yazılmadığını test eder: /api/newsletter/subscribe'a
// bir POST isteği gönderir ve yanıtı raporlar.
//
// Kullanım:
//   node scripts/test-newsletter-subscribe.mjs [base-url] [email]
//
// Örnekler:
//   node scripts/test-newsletter-subscribe.mjs
//     -> http://localhost:3000'e (yerel `pnpm run dev` çalışıyor olmalı),
//        otomatik üretilen bir test e-postasıyla istek gönderir
//   node scripts/test-newsletter-subscribe.mjs https://www.terragolds.com test@ornek.com
//     -> canlı siteye, belirttiğiniz e-postayla istek gönderir

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const email = process.argv[3] ?? `test-${Date.now()}@ornek.com`;
const url = `${baseUrl.replace(/\/$/, "")}/api/newsletter/subscribe`;

console.log(`POST ${url}`);
console.log(`email: ${email}\n`);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // /api/newsletter/subscribe same-origin istek bekliyor
    // (isSameOriginRequest) - tarayıcının fetch()'i bunu otomatik ekler,
    // bu script manuel ekliyor.
    Origin: baseUrl,
  },
  body: JSON.stringify({ email }),
});

const body = await response.json().catch(() => null);
console.log(`status: ${response.status}`);
console.log("body:", body);

if (response.ok) {
  const dbFlag = baseUrl.includes("localhost") ? "--local" : "--remote";
  console.log(
    "\nİstek başarılı. Veritabanına gerçekten yazıldığını doğrulamak için:",
  );
  console.log(
    `  npx wrangler d1 execute terragolds-db ${dbFlag} --command "SELECT * FROM newsletter_subscribers WHERE email = '${email}';"`,
  );
} else {
  console.log("\nİstek başarısız oldu, body'deki hata mesajına bakın.");
  process.exitCode = 1;
}
