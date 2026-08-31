"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { CategorySubgroup } from "../lib/category-subgroups";

/**
 * One top-nav category item. Opens its subcategory panel on hover (desktop)
 * or on tapping the chevron (touch, where hover doesn't fire reliably), and
 * closes on mouse-leave, a click outside the item, or scroll/resize.
 *
 * The panel is rendered into a portal on document.body, positioned with
 * `position: fixed` from the item's own bounding rect, rather than nested
 * inside .market-category-nav with `position: absolute`. That nav bar gets
 * `overflow-x: auto` below 1100px for its horizontal scroll - and per the
 * CSS overflow spec, once one axis is non-visible the other axis computes
 * to `auto` too (browsers don't support "scroll x, but let y overflow
 * freely"), so a dropdown nested inside it was being clipped and never
 * visible at those widths. Escaping via a portal sidesteps that entirely.
 */
export default function CategoryNavDropdown({
  label,
  href,
  subgroups,
  active,
}: {
  label: string;
  href: string;
  subgroups: CategorySubgroup[];
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("click", onDocumentClick);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const openDropdown = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom, left: rect.left + rect.width / 2 });
    setOpen(true);
  };

  // A single subgroup would just duplicate the parent link, so it's not
  // worth a dropdown - only show one once there's an actual choice to make.
  if (subgroups.length <= 1) {
    return (
      <Link href={href} className={active ? "active" : undefined}>
        {label}
      </Link>
    );
  }

  return (
    <div
      className={`category-nav-item${open ? " open" : ""}`}
      ref={rootRef}
      onMouseEnter={openDropdown}
      onMouseLeave={() => setOpen(false)}
    >
      <Link href={href} className={active ? "active" : undefined}>
        {label}
      </Link>
      <button
        type="button"
        className="category-nav-toggle"
        aria-expanded={open}
        aria-label={`${label} alt kategorilerini ${open ? "kapat" : "aç"}`}
        onClick={(event) => {
          event.stopPropagation();
          if (open) setOpen(false);
          else openDropdown();
        }}
      >
        <ChevronDown aria-hidden="true" size={14} strokeWidth={2.25} />
      </button>
      {open && position &&
        createPortal(
          <div
            className="category-nav-dropdown"
            style={{ top: position.top, left: position.left }}
          >
            {subgroups.map((sub) => (
              <Link key={sub.slug} href={`${href}?alt=${sub.slug}`} onClick={() => setOpen(false)}>
                {sub.label}
              </Link>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
