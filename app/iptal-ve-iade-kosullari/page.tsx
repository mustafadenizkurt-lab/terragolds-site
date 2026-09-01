import { permanentRedirect } from "next/navigation";

// /iptal-ve-iade-kosullari rendered LegalDocumentPage document="deliveryReturns" -
// the exact same body content (including the return request form) as
// /teslimat-ve-iade, just under a different title. No internal link
// anywhere in the site points here (footer/nav/product page/legal aside
// all use /teslimat-ve-iade), so that's the de facto canonical URL -
// redirect here instead of serving a duplicate.
export default function CancellationAndReturnsRedirect(): never {
  permanentRedirect("/teslimat-ve-iade");
}
