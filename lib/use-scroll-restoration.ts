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

    // A back-navigation to this page is very often served from the
    // browser's back/forward cache (bfcache) - the frozen page is resumed
    // as-is, WITHOUT React ever re-running this mount effect, so a plain
    // "restore once on mount" never fires again on the actual back-nav that
    // needs it. `pageshow` is the one event that reliably fires both for a
    // genuine fresh mount and for a bfcache resume (as `event.persisted`),
    // because the listener itself survives the freeze/thaw - so the restore
    // logic lives entirely in this handler instead of the effect body.
    let cancelRestore: (() => void) | null = null;
    const restore = (source: string) => {
      cancelRestore?.();
      const target = Number(window.sessionStorage.getItem(storageKey));
      window.sessionStorage.setItem(
        `${storageKey}-debug`,
        JSON.stringify({ source, target, at: Date.now() }),
      );
      if (!Number.isFinite(target) || target <= 0) return;

      // Keep re-asserting the saved position for several seconds while
      // content (images in particular) is still streaming in and growing
      // the page - grids with a dozen+ product photos can take a while to
      // reach their final height, and stopping as soon as the target is
      // briefly "reached" isn't safe either: a later image finishing
      // (replacing a placeholder height with its real, usually smaller,
      // size) can trigger the browser's own scroll anchoring and quietly
      // drag the position back down afterwards. Keep correcting for the
      // full window regardless, and stop only if the visitor scrolls or
      // touches on their own.
      let cancelled = false;
      const stop = () => {
        cancelled = true;
      };
      window.addEventListener("wheel", stop, { once: true, passive: true });
      window.addEventListener("touchstart", stop, { once: true, passive: true });
      cancelRestore = () => {
        cancelled = true;
        window.removeEventListener("wheel", stop);
        window.removeEventListener("touchstart", stop);
      };

      const start = Date.now();
      const MAX_DURATION_MS = 4000;
      const tick = () => {
        if (cancelled) return;
        // The site sets `scroll-behavior: smooth` globally, which hijacks
        // even the plain (x, y) form of scrollTo - restarting a
        // smooth-scroll animation 60x/second overshoots wildly (confirmed:
        // lands at the very bottom of the page instead of the target).
        // "instant" bypasses that CSS entirely.
        window.scrollTo({ top: target, left: 0, behavior: "instant" });
        if (Date.now() - start < MAX_DURATION_MS) {
          window.requestAnimationFrame(tick);
        }
      };
      tick();
    };

    restore("mount");
    const onPageshow = (event: PageTransitionEvent) =>
      restore(event.persisted ? "pageshow-bfcache" : "pageshow-fresh");
    window.addEventListener("pageshow", onPageshow);

    return () => {
      cancelRestore?.();
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
      window.removeEventListener("pageshow", onPageshow);
    };
  }, [storageKey]);
}
