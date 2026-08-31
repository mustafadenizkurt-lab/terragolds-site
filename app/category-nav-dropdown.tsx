"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { CategorySubgroup } from "../lib/category-subgroups";

/**
 * One top-nav category item. Opens its subcategory panel on hover (desktop)
 * or on tapping the chevron (touch, where hover doesn't fire reliably), and
 * closes on mouse-leave or on a click outside the item.
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

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
      onMouseEnter={() => setOpen(true)}
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
          setOpen((current) => !current);
        }}
      >
        <ChevronDown aria-hidden="true" size={14} strokeWidth={2.25} />
      </button>
      {open && (
        <div className="category-nav-dropdown">
          {subgroups.map((sub) => (
            <Link key={sub.slug} href={`${href}?alt=${sub.slug}`} onClick={() => setOpen(false)}>
              {sub.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
