"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function FloatingSocialVisibility({
  children,
  ariaLabel = "Hizli iletisim",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  const [scrolling, setScrolling] = useState(false);
  const settleTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolling(true);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setScrolling(false), 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    };
  }, []);

  return (
    <nav
      className={`floating-social${scrolling ? " floating-social-scrolling" : ""}`}
      aria-label={ariaLabel}
    >
      {children}
    </nav>
  );
}
