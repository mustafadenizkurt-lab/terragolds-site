import type { Metadata } from "next";
import { headers } from "next/headers";
import { getOptionalEnv } from "../lib/runtime-env";
import { readPublishedSiteContent } from "../lib/site-content";
import { defaultSiteContent } from "../lib/site-content-types";
import { readSettings } from "../lib/store-db";
import { CartProvider } from "../lib/cart-context";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readPublishedSiteContent().catch(
    () => defaultSiteContent,
  );
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "www.terragolds.com";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: content.seoHomeTitle,
      template: "%s | Terragolds",
    },
    description: content.seoHomeDescription,
    applicationName: "Terragolds",
    keywords: [
      "doğal taş",
      "kristal",
      "ametist",
      "pembe kuvars",
      "koleksiyon taşı",
      "doğal taş satın al",
      "kristal taş mağazası",
      "ham doğal taş",
      "kuvars taşı",
      "gümüş yüzük",
      "gold kaplama takı",
      "bileklik",
      "kolye",
      "küpe",
      "el işçiliği takı",
      "Terragolds",
    ],
    alternates: {
      canonical: `${origin}/`,
    },
    openGraph: {
      title: content.seoHomeTitle,
      description: content.seoHomeDescription,
      type: "website",
      locale: "tr_TR",
      siteName: "Terragolds",
      url: `${origin}/`,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "Terragolds doğal taş koleksiyonu",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@terragolds",
      title: content.seoHomeTitle,
      description: content.seoHomeDescription,
      images: [`${origin}/og.png`],
    },
    verification: {
      google: getOptionalEnv("GOOGLE_SITE_VERIFICATION") || undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await readSettings().catch(() => null);
  const gaId = settings?.gaMeasurementId.trim();
  const pixelId = settings?.metaPixelId.trim();

  return (
    <html lang="tr">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {gaId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId.replaceAll("'", "")}');`,
              }}
            />
          </>
        )}
        {pixelId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId.replaceAll("'", "")}');fbq('track','PageView');`,
            }}
          />
        )}
      </head>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}