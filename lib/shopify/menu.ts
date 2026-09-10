import { shopifyGraphQL } from "./client";
import { categoryCollectionDefinitions, ensureCategoryCollections } from "./collections";
import { getMainThemeId, getThemeFile, upsertThemeFile } from "./theme";

type MenuItem = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  resourceId: string | null;
  items: MenuItem[];
};

async function getMainMenu(
  accessToken: string,
): Promise<{ id: string; title: string; items: MenuItem[] }> {
  const data = await shopifyGraphQL<{
    menus: { nodes: { id: string; handle: string; title: string; items: MenuItem[] }[] };
  }>(
    accessToken,
    `query {
      menus(first: 10) {
        nodes {
          id
          handle
          title
          items { id title type url resourceId items { id title type url resourceId } }
        }
      }
    }`,
    {},
  );
  const menu = data.menus.nodes.find((node) => node.handle === "main-menu");
  if (!menu) {
    throw new Error("Shopify mağazasında 'main-menu' bulunamadı.");
  }
  return menu;
}

// Rewrites the main navigation in Turkish and adds a "Koleksiyonlar"
// dropdown linking to the 8 category collections - the store's nav
// shipped with Shopify's default English "Home / Catalog / Contact" and
// never got updated when the categories were added, so it didn't reflect
// any of this redesign. Existing item ids/links (Home, Catalog, the
// Contact page) are preserved and only retitled, so nothing already
// bookmarked or linked elsewhere breaks.
export async function applyMainMenu(accessToken: string): Promise<void> {
  const handlesByTitle = await ensureCategoryCollections(accessToken);
  const menu = await getMainMenu(accessToken);

  const home = menu.items.find((item) => item.type === "FRONTPAGE");
  const catalog = menu.items.find((item) => item.type === "CATALOG");
  const contact = menu.items.find((item) => item.type === "PAGE");

  const items: Record<string, unknown>[] = [];
  if (home) {
    items.push({ id: home.id, title: "Ana Sayfa", type: home.type, url: home.url });
  }
  if (catalog) {
    // Shopify's built-in /collections/all catalog page has a fixed,
    // un-editable English title ("Products") - pointing this item at our
    // own "tum-urunler" collection instead (already used on the homepage)
    // keeps the Turkish title consistent across the site.
    items.push({
      id: catalog.id,
      title: "Tüm Ürünler",
      type: "HTTP",
      url: "/collections/tum-urunler",
    });
  }

  items.push({
    title: "Koleksiyonlar",
    type: "HTTP",
    url: "/collections/all",
    items: categoryCollectionDefinitions.map((definition) => ({
      title: definition.title,
      type: "HTTP",
      url: `/collections/${handlesByTitle[definition.title]}`,
    })),
  });

  if (contact) {
    items.push({
      id: contact.id,
      title: "İletişim",
      type: contact.type,
      url: contact.url,
      resourceId: contact.resourceId,
    });
  }

  const data = await shopifyGraphQL<{
    menuUpdate: { userErrors: { field: string[]; message: string }[] };
  }>(
    accessToken,
    `mutation menuUpdate($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, items: $items) {
        userErrors { field message }
      }
    }`,
    { id: menu.id, title: menu.title, items },
  );
  if (data.menuUpdate.userErrors.length) {
    throw new Error(data.menuUpdate.userErrors.map((error) => error.message).join(", "));
  }

  // The new "Koleksiyonlar" dropdown needs the mobile drawer to expand
  // sub-items in place - without this, the 8 categories aren't reachable
  // on mobile at all.
  const themeId = await getMainThemeId(accessToken);
  const headerRaw = await getThemeFile(accessToken, themeId, "sections/header-group.json");
  if (!headerRaw) {
    throw new Error("sections/header-group.json okunamadı.");
  }
  const headerData = JSON.parse(headerRaw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "")) as {
    sections: Record<string, { type?: string; blocks?: Record<string, { type?: string; settings?: Record<string, unknown> }> }>;
  };
  const headerSection = Object.values(headerData.sections).find((section) => section.type === "header");
  const menuBlock = headerSection?.blocks
    ? Object.values(headerSection.blocks).find((block) => block.type === "_header-menu")
    : undefined;
  if (menuBlock?.settings) {
    menuBlock.settings.drawer_accordion = true;
  }
  await upsertThemeFile(
    accessToken,
    themeId,
    "sections/header-group.json",
    JSON.stringify(headerData, null, 2),
  );
}
