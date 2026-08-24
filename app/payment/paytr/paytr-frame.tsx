"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    iFrameResize?: (
      options: Record<string, unknown>,
      target: string,
    ) => void;
  }
}

const RESIZER_ID = "paytr-iframe-resizer-v2";

export default function PaytrFrame({ token }: { token: string }) {
  useEffect(() => {
    const resize = () => {
      window.iFrameResize?.({ checkOrigin: false }, "#paytriframe");
    };
    const existing = document.getElementById(RESIZER_ID) as
      | HTMLScriptElement
      | null;
    if (existing) {
      if (window.iFrameResize) resize();
      else existing.addEventListener("load", resize, { once: true });
      return () => existing.removeEventListener("load", resize);
    }

    const script = document.createElement("script");
    script.id = RESIZER_ID;
    script.src = "https://www.paytr.com/js/iframeResizer.min.js?v2";
    script.async = true;
    script.addEventListener("load", resize, { once: true });
    document.head.appendChild(script);
    return () => script.removeEventListener("load", resize);
  }, []);

  return (
    <iframe
      id="paytriframe"
      title="PayTR güvenli ödeme"
      src={`https://www.paytr.com/odeme/guvenli/${encodeURIComponent(token)}`}
      allow="payment"
    />
  );
}
