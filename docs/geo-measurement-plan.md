# GEO / AI-Search Measurement Plan

## What's already wired

* **Google Analytics 4** — `gaMeasurementId` store setting (currently set
  to a real ID in production), loaded via `gtag.js` in `app/layout.tsx`.
  Fires on every page since it's in the root layout.
* **Meta Pixel** — `metaPixelId` store setting, also loaded in
  `app/layout.tsx`. Not relevant to AI-search measurement, noted for
  completeness.

No server-side request logging is currently wired up (Cloudflare Workers
don't retain request logs by default — see "Server-side visibility"
below for what enabling that would take).

## Tracking AI-answer-engine traffic in GA4

AI assistants send visitors as normal referral/session traffic — there
is no special GA4 channel for them out of the box. Do this in GA4:

1. **Reports → Acquisition → Traffic acquisition**, add a secondary
   dimension of **Session source / medium**, then filter/search the
   source column for these known referrer hostnames:
   * `chat.openai.com`, `chatgpt.com`
   * `perplexity.ai`
   * `claude.ai`
   * `gemini.google.com`
   * `copilot.microsoft.com`
   * `poe.com`
   * `you.com`
   * `phind.com`
2. Build a saved **Exploration** (Explore → Free form) with:
   * Dimension: `Session source / medium`
   * Dimension: `Landing page + query string`
   * Dimension: `Page referrer` (custom dimension — see below)
   * Metric: Sessions, Engaged sessions, Conversions
   * Filter: source matches the hostnames above (regex, e.g.
     `chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|poe\.com|you\.com|phind\.com`)
3. **Google Search Console** also now separately reports **AI Overviews**
   appearances/clicks for Google properties under Performance → Search
   type filters, once available for the account/site — check there too,
   it's a first-party signal GA4 won't show.

### Conversion / signup-equivalent events to watch

Terragolds doesn't have a "signup" funnel in the SaaS sense; the
equivalent conversion events for this store are:

* `add_to_cart` (if not already firing — verify with GA4 DebugView)
* `begin_checkout`
* `purchase` (the real conversion event — tie this to the AI-referrer
  segment above to see if AI-search traffic actually buys, not just
  visits)
* A newsletter signup event, since a newsletter form exists on the
  homepage (`app/home-client.tsx`) — verify it's actually sending a GA4
  event; the current code did not show one wired up as of this audit and
  is worth checking/adding if conversion tracking from AI-search traffic
  matters.

## Server-side visibility (optional, more setup)

Cloudflare Workers requests aren't logged persistently by default. To
inspect raw AI-bot visits (GPTBot, ClaudeBot, PerplexityBot, etc.) at the
HTTP level rather than through GA4 (which only sees browser-executed
sessions, not headless crawler fetches):

1. Enable **Cloudflare Logpush** (or **Instant Logs** for spot-checks) on
   the zone, exporting to R2, S3, or a log sink.
2. Filter/query the exported logs for `User-Agent` containing:
   `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `Claude-User`,
   `Claude-SearchBot`, `PerplexityBot`, `Perplexity-User`,
   `Google-Extended`, `Applebot-Extended`.
3. This tells you which pages these crawlers actually fetch and how
   often — useful to confirm `/sss`, `/llms.txt`, and product pages are
   being picked up after the robots.txt/sitemap changes in this pass.

This is a manual Cloudflare dashboard action (Logpush needs to be turned
on and a destination configured) — it is not something this codebase
change can enable on its own.

## Suggested review cadence

* Weekly for the first month after this GEO pass ships: check the GA4
  AI-referrer exploration and Search Console for any early signal.
* Monthly after that: re-check whether `llms.txt`/`llms-full.txt` still
  match reality (payment providers enabled, shipping fee, categories) —
  these are hand-written facts, not live-rendered, so they can drift if
  the business changes shipping fees, enables Shopier/iyzico, etc.
