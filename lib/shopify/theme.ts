import { shopifyGraphQL } from "./client";

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
