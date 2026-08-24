export function normalizeCustomerName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr-TR")
    .slice(0, 80);
}
