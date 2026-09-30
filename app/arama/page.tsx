import type { Metadata } from "next";
import StoreSubpageHeader from "../store-subpage-header";
import StoreSiteFooter from "../store-site-footer";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreTrustBar from "../store-trust-bar";
import SearchPageBody from "./search-page-body";
import { readProductsPage, readSettings } from "../../lib/store-db";

export const dynamic = "force-dynamic";

const SEARCH_PRODUCTS_PER_PAGE = 30;

type SearchPageProps = {
  searchParams: Promise<{ q?: string; sayfa?: string; sirala?: string }>;
};

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  return {
    title: query ? `"${query}" için arama sonuçları | Terragolds` : "Arama | Terragolds",
    // Sorgu bazlı sayfalar taranmasın - kategori sayfalarının aksine sabit,
    // linklenebilir bir içeriği yok.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, sayfa, sirala } = await searchParams;
  const query = (q ?? "").trim();
  const requestedPage = Number(sayfa);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [result, settings] = await Promise.all([
    readProductsPage({ q: query, page, pageSize: SEARCH_PRODUCTS_PER_PAGE, sort: sirala }),
    readSettings(),
  ]);

  return (
    <main className="category-page">
      <StoreSubpageHeader />
      <StoreTrustBar />

      <SearchPageBody
        query={query}
        products={result.products}
        totalCount={result.totalCount}
        page={result.page}
        totalPages={result.totalPages}
        sort={sirala}
      />

      <StoreSiteFooter
        businessName={settings.businessName}
        address={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
        phone={settings.phone}
        whatsapp={settings.whatsapp}
        email={settings.email}
        instagram={settings.instagram}
        facebook={settings.facebook}
        tiktok={settings.tiktok}
      />
      <FloatingSocialLinks />
    </main>
  );
}
