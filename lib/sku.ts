/** Build an editable default SKU from a product name. */
export function generateSkuFromName(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix = Date.now().toString(36).toUpperCase().slice(-4);
  return slug ? `PRD-${slug}-${suffix}` : `PRD-${suffix}`;
}
