/**
 * A short, self-contained "Short answer:" callout. AI answer engines
 * (and human skimmers) tend to lift the first concrete sentence on a
 * page - this gives them one written specifically to be quoted, instead
 * of leaving them to extract a summary from marketing copy.
 */
export default function AISummaryBlock({
  label = "Kısaca",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <p className="ai-summary-block">
      <strong>{label}:</strong> {children}
    </p>
  );
}
