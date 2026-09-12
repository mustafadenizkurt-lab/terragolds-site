import type { Metadata } from "next";
import { readSettings } from "../../lib/store-db";
import { readPublishedSiteContent } from "../../lib/site-content";
import { defaultSiteContent } from "../../lib/site-content-types";
import StoreSubpageHeader from "../store-subpage-header";
import StoreSiteFooter from "../store-site-footer";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreTrustBar from "../store-trust-bar";
import SupportPageBody from "./support-page-body";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readPublishedSiteContent().catch(
    () => defaultSiteContent,
  );
  return {
    title: content.seoSupportTitle,
    description: content.seoSupportDescription,
  };
}

export default async function SupportPage() {
  const [settings, content] = await Promise.all([
    readSettings(),
    readPublishedSiteContent().catch(() => defaultSiteContent),
  ]);

  return (
    <main className="support-page">
      <StoreSubpageHeader />
      <StoreTrustBar />

      <SupportPageBody settings={settings} content={content} />

      <StoreSiteFooter
        description={content.footerDescription}
        footerNote={settings.footerNote}
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
