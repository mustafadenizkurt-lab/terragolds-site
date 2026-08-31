import { defaultSettings } from "../lib/store-data";
import { readSettings } from "../lib/store-db";
import HomeClient from "./home-client";

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
  return <HomeClient initialSettings={settings} />;
}
