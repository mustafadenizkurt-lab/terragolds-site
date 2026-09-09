import { getOnlineStorePublicationId, shopifyGraphQL } from "./client";

type CollectionRule = {
  column:
    | "TYPE"
    | "TITLE"
    | "TAG"
    | "VENDOR";
  relation: "EQUALS" | "CONTAINS";
  condition: string;
};

export type CategoryCollectionDefinition = {
  title: string;
  description: string;
  rules: CollectionRule[];
};

// Groups the real D1 product_type values (sent to Shopify as productType by
// createShopifyProduct) into the homepage's category tiles, plus two
// title-based buckets (Porselen, Koleksiyon) for products that don't have a
// dedicated product_type of their own.
export const categoryCollectionDefinitions: CategoryCollectionDefinition[] = [
  {
    title: "Kolye",
    description:
      "El işçiliğiyle üretilen, günlük kullanımdan özel anlara uzanan zamansız kolye tasarımları.",
    rules: [
      { column: "TYPE", relation: "EQUALS", condition: "Kolye" },
      { column: "TYPE", relation: "EQUALS", condition: "Erkek Kolye" },
    ],
  },
  {
    title: "Yüzük",
    description: "Her tarza uygun, ince işçilikli yüzük koleksiyonu.",
    rules: [
      {
        column: "TYPE",
        relation: "EQUALS",
        condition: "Bayan Yüzük ve Kombinler",
      },
      { column: "TYPE", relation: "EQUALS", condition: "Erkek Yüzük" },
    ],
  },
  {
    title: "Küpe",
    description: "Zarif ve şık küpe modelleriyle stilinizi tamamlayın.",
    rules: [
      { column: "TYPE", relation: "EQUALS", condition: "Küpe" },
      { column: "TYPE", relation: "EQUALS", condition: "Erkek Küpe" },
    ],
  },
  {
    title: "Bileklik",
    description:
      "Katmanlamaya uygun, günlük şıklık için özenle tasarlanmış bileklikler.",
    rules: [
      { column: "TYPE", relation: "EQUALS", condition: "Bayan Bileklik" },
      { column: "TYPE", relation: "EQUALS", condition: "Erkek Bileklik" },
      { column: "TYPE", relation: "EQUALS", condition: "Charm Bileklikler" },
    ],
  },
  {
    title: "Halhal",
    description: "Yazın vazgeçilmezi, zarif ve hafif halhal tasarımları.",
    rules: [{ column: "TYPE", relation: "EQUALS", condition: "Hal Hal" }],
  },
  {
    title: "Vintage",
    description:
      "Zamanın izini taşıyan, özenle seçilmiş antika ve vintage parçalar.",
    rules: [
      { column: "TYPE", relation: "EQUALS", condition: "Antika ~ Vintage" },
    ],
  },
  {
    title: "Porselen",
    description: "El yapımı porselen objelerle evinize zarafet katın.",
    rules: [{ column: "TITLE", relation: "CONTAINS", condition: "Porselen" }],
  },
  {
    title: "Koleksiyon",
    description:
      "Sınırlı sayıda üretilen, koleksiyonluk özel tasarım parçalar.",
    rules: [
      { column: "TITLE", relation: "CONTAINS", condition: "Heykel" },
      { column: "TITLE", relation: "CONTAINS", condition: "Figür" },
      { column: "TITLE", relation: "CONTAINS", condition: "Obje" },
      { column: "TITLE", relation: "CONTAINS", condition: "Biblo" },
    ],
  },
];

async function findCollectionByTitle(
  accessToken: string,
  title: string,
): Promise<{ id: string; handle: string } | null> {
  const data = await shopifyGraphQL<{
    collections: { nodes: { id: string; handle: string; title: string }[] };
  }>(
    accessToken,
    `query collections($query: String!) {
      collections(first: 5, query: $query) {
        nodes { id handle title }
      }
    }`,
    { query: `title:'${title}'` },
  );
  const exact = data.collections.nodes.find((node) => node.title === title);
  return exact ? { id: exact.id, handle: exact.handle } : null;
}

async function createCollection(
  accessToken: string,
  definition: CategoryCollectionDefinition,
): Promise<{ id: string; handle: string }> {
  const data = await shopifyGraphQL<{
    collectionCreate: {
      collection: { id: string; handle: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection { id handle }
        userErrors { field message }
      }
    }`,
    {
      input: {
        title: definition.title,
        descriptionHtml: `<p>${definition.description}</p>`,
        ruleSet: {
          appliedDisjunctively: true,
          rules: definition.rules,
        },
      },
    },
  );
  if (data.collectionCreate.userErrors.length || !data.collectionCreate.collection) {
    throw new Error(
      data.collectionCreate.userErrors.map((error) => error.message).join(", ") ||
        `"${definition.title}" koleksiyonu oluşturulamadı.`,
    );
  }
  return data.collectionCreate.collection;
}

// Backfills the description on a collection created before descriptions
// were added here - a no-op (Shopify just writes the same value) once the
// collection already has it.
async function updateCollectionDescription(
  accessToken: string,
  collectionId: string,
  description: string,
): Promise<void> {
  const data = await shopifyGraphQL<{
    collectionUpdate: {
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation collectionUpdate($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        userErrors { field message }
      }
    }`,
    { input: { id: collectionId, descriptionHtml: `<p>${description}</p>` } },
  );
  if (data.collectionUpdate.userErrors.length) {
    throw new Error(
      data.collectionUpdate.userErrors.map((error) => error.message).join(", "),
    );
  }
}

// A collection isn't visible to theme sections until it's explicitly
// published to the Online Store sales channel - same requirement as
// products (see getOnlineStorePublicationId). Publishing an
// already-published collection is a harmless no-op.
async function publishCollectionToOnlineStore(
  accessToken: string,
  publicationId: string,
  collectionId: string,
): Promise<void> {
  const data = await shopifyGraphQL<{
    publishablePublish: {
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }`,
    { id: collectionId, input: [{ publicationId }] },
  );
  if (data.publishablePublish.userErrors.length) {
    throw new Error(
      data.publishablePublish.userErrors
        .map((error) => error.message)
        .join(", "),
    );
  }
}

// Idempotent: reuses an existing collection with the same title instead of
// creating a duplicate on a retry, and (re-)publishes it every time in case
// an earlier run created it without publishing.
export async function ensureCategoryCollections(
  accessToken: string,
): Promise<Record<string, string>> {
  const publicationId = await getOnlineStorePublicationId(accessToken);
  const handlesByTitle: Record<string, string> = {};
  for (const definition of categoryCollectionDefinitions) {
    const existing = await findCollectionByTitle(accessToken, definition.title);
    const collection = existing ?? (await createCollection(accessToken, definition));
    if (existing) {
      await updateCollectionDescription(accessToken, collection.id, definition.description);
    }
    await publishCollectionToOnlineStore(accessToken, publicationId, collection.id);
    handlesByTitle[definition.title] = collection.handle;
  }
  return handlesByTitle;
}
