import { defaultSettings } from "../lib/store-data";
import { readSettings } from "../lib/store-db";
import type { Metadata } from "next";
import HomeClient from "./home-client";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.terragolds.com/" },
};

export const dynamic = "force-dynamic";

// Deliberately does NOT use readStorefrontData() here: that also reads the
// full product catalog (thousands of rows) and CMS content, and rendering
// all of that into the initial HTML on every request blew past the
// Worker's CPU/memory limits (Cloudflare error 1102). Settings is a single
// small row, cheap to fetch server-side, and it's the only piece that
// actually needed to be correct on first paint (social links, analytics
// IDs). Products/content/categories stay client-fetched, same as before.
export default async function Home() {
  const settings = await readSettings().catch(() => defaultSettings);
  return (
    <>
      {/* The visible homepage is client-rendered and has no <h1>; this gives
          crawlers the page's main heading in the initial HTML. */}
      <h1 className="sr-only">Terragolds – Zarif Takı ve Aksesuar Koleksiyonları</h1>
      <HomeClient initialSettings={settings} />
    </>
  );
}
