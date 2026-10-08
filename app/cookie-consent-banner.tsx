"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tg_cookie_consent";

type ConsentValue = "accepted" | "rejected";

function readStoredConsent(): ConsentValue | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

function loadGoogleAnalytics(gaId: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.appendChild(script);
  const inline = document.createElement("script");
  inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId.replaceAll("'", "")}');`;
  document.head.appendChild(inline);
}

function loadMetaPixel(pixelId: string) {
  const script = document.createElement("script");
  script.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId.replaceAll("'", "")}');fbq('track','PageView');`;
  document.head.appendChild(script);
}

// GA/Meta Pixel artık burada, rıza verilmeden ASLA enjekte edilmiyor -
// app/layout.tsx'te sunucu tarafında koşulsuz render ediliyorlardı, çerez
// politikası sayfasıyla tutarsızdı. "Reddet" seçilirse bu oturumda hiç
// yüklenmezler; "Kabul Et" seçilirse hemen (ve sonraki ziyaretlerde
// localStorage'daki karar hatırlanarak otomatik) yüklenirler.
export default function CookieConsentBanner({
  gaId,
  pixelId,
}: {
  gaId: string;
  pixelId: string;
}) {
  const [consent, setConsent] = useState<ConsentValue | null>("rejected");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsent(readStoredConsent());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (consent !== "accepted") return;
    if (gaId) loadGoogleAnalytics(gaId);
    if (pixelId) loadMetaPixel(pixelId);
    // Yalnızca sayfa açılışında bir kez çalışsın - consent "accepted" olarak
    // sabitlendiği sürece yeniden tetiklenip script'leri ikinci kez eklemesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent === "accepted"]);

  if (!hydrated || consent !== null) return null;

  const decide = (value: ConsentValue) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Private mode / storage disabled - the choice just won't persist
      // across visits, banner will show again next time.
    }
    setConsent(value);
  };

  return (
    <div className="cookie-consent-banner" role="dialog" aria-label="Çerez onayı">
      <p>
        Size daha iyi bir alışveriş deneyimi sunmak için çerezler kullanıyoruz.
        Detaylar için{" "}
        <a href="/cerez-politikasi">çerez politikamızı</a> inceleyebilirsiniz.
      </p>
      <div className="cookie-consent-actions">
        <button type="button" onClick={() => decide("rejected")}>
          Reddet
        </button>
        <button type="button" className="cookie-consent-accept" onClick={() => decide("accepted")}>
          Kabul Et
        </button>
      </div>
    </div>
  );
}
