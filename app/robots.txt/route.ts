const siteUrl = "https://www.terragolds.com";

// Private/transactional paths kept out of both general and AI-crawler
// rule blocks below - listed once here so the two stay in sync.
const disallowedPaths = [
  "/admin",
  "/api/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/profile",
  "/orders",
  "/favorites",
  "/favoriler",
  "/verify-email",
  "/payment",
];

// Search and AI-answer-engine crawlers we want indexing/citing the public
// storefront (product, category, legal, FAQ pages) - same allow/disallow
// rules as the default group, just named explicitly per engine so intent
// isn't left to each bot's own default behavior.
const aiAndSearchBots = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
];

export async function GET() {
  const rules: string[] = ["User-agent: *", "Allow: /"];
  for (const path of disallowedPaths) rules.push(`Disallow: ${path}`);
  rules.push("");

  for (const bot of aiAndSearchBots) {
    rules.push(`User-agent: ${bot}`, "Allow: /");
    for (const path of disallowedPaths) rules.push(`Disallow: ${path}`);
    rules.push("");
  }

  rules.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  rules.push("");
  rules.push(
    "# AI-assistant reference (product facts, FAQ, what not to claim):",
    `# ${siteUrl}/llms.txt`,
    `# ${siteUrl}/llms-full.txt`,
  );

  return new Response(
    rules.join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
