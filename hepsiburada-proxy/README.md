# hepsiburada-proxy

Cloudflare Workers'tan Hepsiburada'nın bazı uç noktalarına (özellikle
sipariş/`oms-external`) atılan istekler 520 ile dönüyor - bilinen bir
Cloudflare Workers -> Cloudflare origin bot-koruması çakışması. Bu servis,
isteği normal bir sunucu IP'sinden (Render) yeniden atan ince bir vekil.

## Render'da kurulum

1. Render'da **Web Service** oluştur, bu repoyu bağla.
2. **Root Directory**: `hepsiburada-proxy`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment** sekmesinde bir ortam değişkeni ekle:
   - `PROXY_SECRET` = rastgele, uzun bir sır (ör. `openssl rand -hex 32`
     çıktısı). Bunu ayrıca terragolds-site Worker'ının
     `HEPSIBURADA_PROXY_SECRET` secret'ına da **aynı değerle** gireceksin.
6. Deploy olduktan sonra Render'ın verdiği URL'i (ör.
   `https://hepsiburada-proxy-xxxx.onrender.com`) terragolds-site
   Worker'ının `HEPSIBURADA_PROXY_URL` secret'ına gir.

## terragolds-site tarafında

```
npx wrangler secret put HEPSIBURADA_PROXY_URL
npx wrangler secret put HEPSIBURADA_PROXY_SECRET
```

İkisi de tanımlıysa `lib/hepsiburada/client.ts`'teki `hepsiburadaRawFetch`
tüm Hepsiburada isteklerini otomatik olarak bu vekil üzerinden atar; biri
bile eksikse eskisi gibi doğrudan Hepsiburada'ya gider (geriye dönük
uyumlu, aniden kırılma riski yok).

## Test

```
curl https://<render-url>/health
# -> ok
```

`/forward` ise sadece `x-proxy-secret` doğru ve `x-target-url` izinli
Hepsiburada host'larından biriyse (ör. `mpop-sit.hepsiburada.com`) çalışır -
başka hiçbir isteği kabul etmez, açık (herkese açık) bir vekil değildir.
