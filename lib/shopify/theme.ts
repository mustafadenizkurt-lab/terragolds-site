import { shopifyGraphQL } from "./client";
import { categoryCollectionDefinitions, ensureCategoryCollections } from "./collections";

// Themes API - lets a script read/write an Online Store 2.0 theme's JSON
// config and Liquid section files directly, the same mechanism the Shopify
// CLI and theme editor use under the hood.
export async function getMainThemeId(accessToken: string): Promise<string> {
  const data = await shopifyGraphQL<{
    themes: { nodes: { id: string; name: string; role: string }[] };
  }>(
    accessToken,
    `query { themes(first: 10, roles: [MAIN]) { nodes { id name role } } }`,
    {},
  );
  const theme = data.themes.nodes[0];
  if (!theme) {
    throw new Error("Shopify mağazasında aktif (MAIN) tema bulunamadı.");
  }
  return theme.id;
}

export async function getThemeFile(
  accessToken: string,
  themeId: string,
  filename: string,
): Promise<string | null> {
  const data = await shopifyGraphQL<{
    theme: {
      files: {
        nodes: {
          filename: string;
          body: { content?: string } | null;
        }[];
      };
    } | null;
  }>(
    accessToken,
    `query themeFile($id: ID!, $filenames: [String!]!) {
      theme(id: $id) {
        files(filenames: $filenames) {
          nodes {
            filename
            body {
              ... on OnlineStoreThemeFileBodyText { content }
            }
          }
        }
      }
    }`,
    { id: themeId, filenames: [filename] },
  );
  return data.theme?.files.nodes[0]?.body?.content ?? null;
}

// Premium/minimalist brand pass (Apple x Zara Home x Mejuri): a near-black
// on white base for readability, with matte gold reserved for a few
// deliberate accents (primary buttons, sale badges, selected variants) so
// it reads as considered rather than gilded everywhere. Horizon's global
// palette only exposes two anchor colors (background/foreground) - it
// derives every other tint from them - so the accent has to be applied
// per-component instead of as a third global color.
const MATTE_GOLD = "#B08D57";
const INK = "#111111";
const PAPER = "#FFFFFF";

export async function applyBrandTheme(
  accessToken: string,
  themeId: string,
): Promise<void> {
  const raw = await getThemeFile(accessToken, themeId, "config/settings_data.json");
  if (!raw) {
    throw new Error("settings_data.json okunamadı.");
  }
  // Shopify prefixes this file with an auto-generated /* ... */ comment
  // block, which plain JSON.parse can't handle - strip it before parsing.
  const json = raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
  const data = JSON.parse(json) as {
    current: Record<string, unknown>;
    presets?: Record<string, unknown>;
  };

  Object.assign(data.current, {
    type_heading_font: "fraunces_n5",
    type_accent_font: "inter_n6",
    color_palette: { background: PAPER, foreground: INK },
    palette_primary_button_background: MATTE_GOLD,
    palette_primary_button_text: INK,
    palette_primary_button_border: MATTE_GOLD,
    badge_sale_background_color: MATTE_GOLD,
    badge_sale_text_color: INK,
    palette_selected_variant_background: MATTE_GOLD,
    palette_selected_variant_text: INK,
    palette_selected_variant_border: MATTE_GOLD,
  });

  await upsertThemeFile(
    accessToken,
    themeId,
    "config/settings_data.json",
    JSON.stringify(data, null, 2),
  );
}

export async function upsertThemeFile(
  accessToken: string,
  themeId: string,
  filename: string,
  content: string,
): Promise<void> {
  const data = await shopifyGraphQL<{
    themeFilesUpsert: {
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        userErrors { field message }
      }
    }`,
    {
      themeId,
      files: [{ filename, body: { type: "TEXT", value: content } }],
    },
  );
  if (data.themeFilesUpsert.userErrors.length) {
    throw new Error(
      data.themeFilesUpsert.userErrors
        .map((error) => error.message)
        .join(", "),
    );
  }
}

const SECTION_ID_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomSectionSuffix(): string {
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += SECTION_ID_CHARS[Math.floor(Math.random() * SECTION_ID_CHARS.length)];
  }
  return result;
}

type HomepageTemplate = {
  sections: Record<string, unknown>;
  order: string[];
};

// Adds one product-list section per category collection to the homepage,
// right after the hero, by cloning the existing "tum-urunler" product-list
// section (proven-safe pattern already live on the theme) and swapping its
// collection setting - everything else (layout, product-card sub-blocks,
// the {{ closest.collection.title }} header) is reused as-is.
export async function applyHomepageLayout(
  accessToken: string,
  themeId: string,
): Promise<void> {
  const handlesByTitle = await ensureCategoryCollections(accessToken);

  const raw = await getThemeFile(accessToken, themeId, "templates/index.json");
  if (!raw) {
    throw new Error("templates/index.json okunamadı.");
  }
  const json = raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
  const data = JSON.parse(json) as HomepageTemplate;

  const templateSectionId = Object.keys(data.sections).find(
    (id) =>
      (data.sections[id] as { type?: string; settings?: { collection?: string } })
        .type === "product-list",
  );
  const template = templateSectionId ? data.sections[templateSectionId] : undefined;
  if (!template) {
    throw new Error("Ürün listesi şablon bölümü bulunamadı.");
  }

  const existingIds = new Set(Object.keys(data.sections));
  const newSectionIds: string[] = [];

  for (const definition of categoryCollectionDefinitions) {
    const handle = handlesByTitle[definition.title];
    if (!handle) continue;

    let sectionId = `product_list_${randomSectionSuffix()}`;
    while (existingIds.has(sectionId)) {
      sectionId = `product_list_${randomSectionSuffix()}`;
    }
    existingIds.add(sectionId);

    const cloned = JSON.parse(JSON.stringify(template)) as {
      settings: { collection?: string };
    };
    cloned.settings.collection = handle;

    data.sections[sectionId] = cloned;
    newSectionIds.push(sectionId);
  }

  const heroIndex = data.order.findIndex(
    (id) => (data.sections[id] as { type?: string }).type === "hero",
  );
  const insertAt = heroIndex >= 0 ? heroIndex + 1 : 0;
  data.order.splice(insertAt, 0, ...newSectionIds);

  await upsertThemeFile(
    accessToken,
    themeId,
    "templates/index.json",
    JSON.stringify(data, null, 2),
  );
}
