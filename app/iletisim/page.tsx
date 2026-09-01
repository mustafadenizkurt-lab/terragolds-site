import { permanentRedirect } from "next/navigation";

// /iletisim used to re-export /support's page verbatim - same content
// under two indexable URLs, which Google flags as duplicate content.
// No internal link anywhere in the site points to /iletisim (every nav/
// footer/search link uses /support), so /support is the de facto
// canonical URL - redirect here instead of serving a duplicate.
export default function IletisimRedirect(): never {
  permanentRedirect("/support");
}
