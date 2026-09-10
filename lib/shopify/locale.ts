import { shopifyGraphQL } from "./client";

// Adds Turkish as a secondary shop language (English stays primary) and
// publishes it, so it's live on the storefront immediately - without this,
// a locale exists in a disabled/unpublished state and never appears to
// visitors or in the header's language switcher.
export async function enableTurkishLocale(accessToken: string): Promise<void> {
  const enableData = await shopifyGraphQL<{
    shopLocaleEnable: {
      shopLocale: { locale: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation shopLocaleEnable($locale: String!) {
      shopLocaleEnable(locale: $locale) {
        shopLocale { locale }
        userErrors { field message }
      }
    }`,
    { locale: "tr" },
  );
  // "already enabled"-type errors are fine on a retry; anything else isn't.
  const enableErrors = enableData.shopLocaleEnable.userErrors.filter(
    (error) => !/already/i.test(error.message),
  );
  if (enableErrors.length) {
    throw new Error(enableErrors.map((error) => error.message).join(", "));
  }

  const updateData = await shopifyGraphQL<{
    shopLocaleUpdate: {
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation shopLocaleUpdate($locale: String!, $shopLocale: ShopLocaleInput!) {
      shopLocaleUpdate(locale: $locale, shopLocale: $shopLocale) {
        userErrors { field message }
      }
    }`,
    { locale: "tr", shopLocale: { published: true } },
  );
  if (updateData.shopLocaleUpdate.userErrors.length) {
    throw new Error(
      updateData.shopLocaleUpdate.userErrors.map((error) => error.message).join(", "),
    );
  }
}
