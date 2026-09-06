# GEO / AI-Search Implementation Report

Companion document: `/docs/geo-product-audit.md` (product facts and
scoping rationale). This report covers what was actually shipped.

## 1. Summary

Implemented a GEO/AI-search foundation for Terragolds — a Turkish
jewelry/accessories e-commerce storefront — scoped to what's real about
this specific product. Several phases of the original request (blog seed
posts, competitor "alternatives" pages, mobile ASO copy) were
deliberately **not** built because this project has no blog, no named
competitors anywhere in its codebase or content, and no mobile app; doing
so would have meant inventing content, which was explicitly disallowed.
See §11 for what's recommended instead.

## 2. Files changed

* `app/layout.tsx` — added global `Organization` + `WebSite` JSON-LD
  (sourced from live store settings), removed the duplicate inline
  versions that were previously hand-rolled inside the homepage
  component.
* `app/home-client.tsx` — removed the duplicate inline Organization/
  WebSite JSON-LD; refactored the existing FAQ accordion onto the shared
  `FAQSection` component (now also emits `FAQPage` schema, which it
  didn't before); added an `AISummaryBlock` short-answer callout in the
  "Seçim yaklaşımımız" section.
* `app/products/[id]/page.tsx` — refactored the inline `Product` JSON-LD
  onto the shared `productSchema()` builder; added a `BreadcrumbList`
  (previously missing on product pages).
* `app/kategori/[slug]/page.tsx` — refactored the inline
  `BreadcrumbList` onto the shared `breadcrumbSchema()` builder (no
  behavior change, just de-duplication).
* `app/hakkimizda/page.tsx` — added a `BreadcrumbList` and an
  `AISummaryBlock` with a link to the new FAQ page.
* `app/store-site-footer.tsx` — added a "Sıkça Sorulan Sorular"/"FAQ"
  link to the Müşteri Hizmetleri/Support footer nav group (TR + EN).
* `app/robots.txt/route.ts` — rewritten to also emit explicit
  `User-agent` blocks for named AI/search crawlers (same allow/disallow
  rules as the default group), plus a comment pointing to `llms.txt`/
  `llms-full.txt`.
* `app/sitemap.xml/route.ts` — added the two new/previously-missing
  entries: `/sss` and `/ozel-uretim`.
* `app/globals.css` — added `.ai-summary-block`, `.faq-more-help`, and
  `.not-found-actions` styles (no existing rules changed).

## 3. New pages created

* **`/sss`** (`app/sss/page.tsx`) — a real FAQ page, 17 questions, all
  answers sourced from live store settings (shipping fee, free-shipping
  threshold, contact details, address) or verified policy facts (PayTR
  as the only active payment provider, 14-day return right, no mobile
  app, no raw-stone products). Carries `FAQPage` and `BreadcrumbList`
  JSON-LD.
* **`app/not-found.tsx`** — a branded 404 page (previously the framework
  default was served for any unmatched URL), with links back to home,
  the catalog, FAQ, and support.

## 4. New files (non-page)

* `lib/seo/structured-data.ts` — shared JSON-LD builders:
  `organizationSchema`, `websiteSchema`, `faqPageSchema`,
  `breadcrumbSchema`, `productSchema`, plus a `toJsonLd()` escaping
  helper. Documents in its own header comment why no `SearchAction` is
  included (no real crawlable search-results URL exists yet).
* `app/faq-section.tsx` — `FAQSection` component: renders a Q&A
  accordion (reusing the site's existing `.faq-list` visual style) and
  its matching `FAQPage` schema from the same data, so they can't drift
  apart.
* `app/ai-summary-block.tsx` — `AISummaryBlock` component: a short
  "Kısaca:" callout for concise, quotable answers.
* `public/llms.txt` — concise AI-assistant reference (what Terragolds
  is/isn't, features, FAQ), all facts pulled from verified settings/code.
* `public/llms-full.txt` — longer reference with feature explanations,
  factual (non-comparative) positioning, a "what not to claim about
  Terragolds" section, and the full URL list.
* `docs/geo-product-audit.md`, `docs/geo-measurement-plan.md`,
  `docs/geo-implementation-report.md` (this file).

## 5. Structured data added

| Schema type | Where | New or refactored |
|---|---|---|
| `Organization` | Global (root layout) | Refactored from a homepage-only duplicate into one global instance with real address/phone/sameAs |
| `WebSite` | Global (root layout) | Same — de-duplicated from the homepage |
| `FAQPage` | Homepage FAQ accordion, `/sss` | New (neither had it before) |
| `BreadcrumbList` | Product pages, `/hakkimizda`, `/sss` | New on product pages and these two pages; already existed on category pages (refactored onto the shared builder) |
| `Product` + `Offer` | Product pages | Refactored onto shared builder, same real fields (price, TRY currency, stock-based availability, real review data only when present) |

No fake ratings, reviews, prices, or addresses were added anywhere —
`aggregateRating` only renders when a product actually has
`reviewCount && reviewAverage` from the database.

## 6. Sitemap status

Working (`app/sitemap.xml/route.ts`, dynamic, DB-driven). Added the two
previously-missing real pages (`/sss`, `/ozel-uretim`). Verified via a
running dev server that both now appear with correct `<loc>` entries.

## 7. Robots.txt status

Working. Verified via a running dev server that it serves valid rules
for `User-agent: *` and 13 explicitly named search/AI crawlers
(Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot,
Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User,
Google-Extended, Applebot, Applebot-Extended), all sharing the same
private-path disallow list, plus a `Sitemap:` line and a comment pointing
at `llms.txt`/`llms-full.txt`. No private route (`/admin`, `/api/`,
account/order/payment pages) is exposed to any of them.

## 8. llms.txt status

`public/llms.txt` and `public/llms-full.txt` created and verified to
return HTTP 200 from a running dev server. Content is derived entirely
from verified sources: `store_settings` (shipping fee, free-shipping
threshold, contact info), `payment_provider_settings` (confirmed only
PayTR is active), the real product-category list, and the site's own
published legal pages (14-day return right). No invented pricing,
testimonials, awards, or founder story.

## 9. Metadata improvements

Audited every public route. Found that titles/descriptions/canonicals on
the homepage, product pages, category pages, and **all** legal pages were
already solid before this pass (real, specific copy — not generic
"Welcome to our store" filler). No changes were needed there. The one
real gap closed was the missing 404 page (now returns a proper 404 status
with real content and internal links instead of the framework default).

## 10. AI-search query targets

See §22–24 of the product audit for the full list; summarized:

* Branded/legitimacy: "Terragolds nedir", "Terragolds güvenilir mi"
* Policy: "Terragolds kargo ücreti", "Terragolds iade politikası"
* Category-intent: "kolye/küpe/bileklik/yüzük satın al"
* Feature: "Terragolds özel tasarım takı", "Terragolds mobil uygulama var mı"

## 11. Remaining recommendations (not built in this pass, and why)

* **Blog** — no blog infrastructure exists (no content model, no admin
  editor, no public route). Adding one is a real product/architecture
  decision (new DB table, admin UI, RSS, moderation) beyond a GEO copy
  pass. If the business wants content marketing, recommend building a
  minimal blog (even 3–5 genuinely written posts on real topics like
  "takı bakımı nasıl yapılır", "hediyelik takı seçerken nelere dikkat
  edilir") as a separate, deliberate project.
* **Comparison / "alternatives" pages** — no named competitors appear
  anywhere in the project, and publishing unsolicited "Terragolds vs
  [Competitor]" content for a small single-location business carries
  real reputational/legal risk with no factual basis to back it. Not
  built. If desired later, this needs the business owner to name real,
  fair comparison points first.
* **Mobile app / ASO copy** — not applicable; no iOS/Android app exists.
* **Real crawlable search-results URL** — the current on-page search is
  a client-side hash deep link (`/#shop?search=...`), which is why no
  `SearchAction`/Sitelinks-Search-Box schema was added. Building a real
  `?search=` SSR route would unlock this schema and a genuine indexable
  search-results page.
* **Fix the dead `homeHero*` CMS fields** — `lib/site-content-types.ts`
  defines and the admin panel exposes homepage hero fields
  (`homeHeroTitle`, `homeHeroDescription`, etc.) that are never actually
  rendered anywhere (the real hero is a separate hardcoded carousel).
  This is a pre-existing admin-UX bug, unrelated to GEO, flagged for a
  future fix rather than addressed here.
* **Verify newsletter signup fires a GA4 event** — noted in the
  measurement plan; the homepage has a newsletter form but no confirmed
  GA4 event was found wired to it.

## 12. Manual actions the owner must do

* Submit `sitemap.xml` to Google Search Console and Bing Webmaster
  Tools (if not already done — a prior session in this project already
  covers general GSC usage).
* Request indexing for the new `/sss` page and any product/category
  pages that matter most, via GSC's URL Inspection tool.
* Re-verify `public/llms.txt` / `public/llms-full.txt` periodically
  against reality — they're hand-written facts (shipping fee, active
  payment provider, category list), not live-rendered, so they will
  drift if the business changes these settings (e.g. if Shopier or
  iyzico is enabled later, both files need a one-line update).
* If Cloudflare Logpush is wanted to inspect real AI-crawler HTTP
  traffic (GPTBot, ClaudeBot, etc.), that's a Cloudflare dashboard
  setting — see `/docs/geo-measurement-plan.md`.
* Decide whether to invest in a blog or comparison content — both are
  legitimate future GEO levers but need real content decisions from the
  business, not fabricated copy.
