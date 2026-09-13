"use client";

import { useEffect } from "react";

/**
 * Restores scroll position when a visitor returns (browser back) to a page
 * whose content loads via client-side fetch after mount - without this, the
 * browser's own scroll-restore fires before the page reaches its final
 * height and undershoots (or, on pages with no restore attempt at all,
 * simply resets to 0), which reads to a visitor as "back sent me to the
 * wrong place". Call once per page-level client component with a
 * page-unique sessionStorage key.
 */
export function useScrollRestoration(storageKey: string) {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const saveScroll = () => {
      window.sessionStorage.setItem(storageKey, String(window.scrollY));
    };
    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pagehide", saveScroll);

    const target = Number(window.sessionStorage.getItem(storageKey));
    if (!Number.isFinite(target) || target <= 0) {
      return () => {
        window.removeEventListener("scroll", saveScroll);
        window.removeEventListener("pagehide", saveScroll);
      };
    }

    // Keep re-asserting the saved position while content (images in
    // particular) is still streaming in and growing the page - a fixed
    // short timeout isn't enough for grids with a dozen+ product photos,
    // which can take longer than that to reach their final height, leaving
    // the restore stuck wherever the page happened to be clamped to when
    // the timeout gave up. Stop as soon as the target is actually reached,
    // the visitor scrolls/touches on their own, or a generous safety cap
    // elapses (a broken image or infinite layout shift shouldn't spin this
    // forever).
    let cancelled = false;
    const stop = () => {
      cancelled = true;
    };
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchstart", stop, { once: true, passive: true });

    const start = Date.now();
    const MAX_DURATION_MS = 6000;
    const tick = () => {
      if (cancelled) return;
      // The site sets `scroll-behavior: smooth` globally, which hijacks even
      // the plain (x, y) form of scrollTo - restarting a smooth-scroll
      // animation 60x/second overshoots wildly (confirmed: lands at the very
      // bottom of the page instead of the target). "instant" bypasses that
      // CSS entirely.
      window.scrollTo({ top: target, left: 0, behavior: "instant" });
      const reached = Math.abs(window.scrollY - target) < 2;
      if (!reached && Date.now() - start < MAX_DURATION_MS) {
        window.requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, [storageKey]);
}
