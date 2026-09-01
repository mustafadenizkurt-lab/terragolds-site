const siteUrl = "https://www.terragolds.com";

export async function GET() {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /api/",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /forgot-password",
      "Disallow: /reset-password",
      "Disallow: /profile",
      "Disallow: /orders",
      "Disallow: /favorites",
      "Disallow: /favoriler",
      "Disallow: /verify-email",
      "Disallow: /payment",
      `Sitemap: ${siteUrl}/sitemap.xml`,
      "",
    ].join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
