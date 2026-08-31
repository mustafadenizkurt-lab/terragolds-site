import { readStorefrontData } from "../lib/storefront-data";
import HomeClient from "./home-client";

export default async function Home() {
  const data = await readStorefrontData();
  return (
    <HomeClient
      initialProducts={data.products}
      initialSettings={data.settings}
      initialContent={data.content}
      initialCategories={data.categories}
    />
  );
}
