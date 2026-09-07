import { faqPageSchema, toJsonLd, type FaqEntry } from "../lib/seo/structured-data";

/**
 * Renders a Q&A accordion (the site's existing .faq-list look) plus its
 * matching FAQPage JSON-LD from the same data, so the structured data can
 * never drift from what's actually visible on the page (a mismatch there
 * violates Google's FAQPage guidelines). Deliberately un-wrapped in its
 * own <section> - callers already provide their own heading/layout
 * (homepage two-column FAQ, standalone /sss page, etc).
 */
export default function FAQSection({
  items,
  className,
}: {
  items: FaqEntry[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(faqPageSchema(items)) }}
      />
      <div className={className ?? "faq-list"}>
        {items.map((item) => (
          <details key={item.question}>
            <summary>
              {item.question}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </>
  );
}
