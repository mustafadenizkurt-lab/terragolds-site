export const dynamic = "force-static";

// Admin panelini telefonun ana ekranına "uygulama" gibi eklenebilir yapan
// PWA manifest'i - start_url/scope kasıtlı olarak /admin: ikona dokununca
// doğrudan yönetim paneli açılıyor, mağaza sayfaları bu "uygulama"nın
// kapsamında değil. sitemap.xml/robots.txt ile aynı desen (app/<dosya
// adı>/route.ts) - bu projede Next.js'in dosya tabanlı metadata
// kuralı (app/manifest.ts) yerine düz route handler kullanılıyor.
export async function GET() {
  const manifest = {
    name: "Terragolds Yönetim Paneli",
    short_name: "Terragolds",
    description: "Terragolds admin paneli - sipariş, ürün ve entegrasyon yönetimi.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#111c18",
    theme_color: "#111c18",
    lang: "tr",
    icons: [
      { src: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json" },
  });
}
