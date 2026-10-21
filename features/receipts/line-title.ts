/**
 * Receipt / ESC/POS line title — include the chosen sell unit (pack/carton)
 * so multi-unit sales do not look like the product's default pack.
 */
export function formatReceiptProductName(line: {
  productName: string;
  sellUnitLabel?: string | null;
}): string {
  const name = line.productName.trim() || "Item";
  const pack = line.sellUnitLabel?.trim();
  if (!pack) return name;
  // Skip redundant "default" keys that some legacy rows stored as the label.
  if (pack.toLowerCase() === "default") return name;
  return `${name} (${pack})`;
}

export function formatReceiptLineTitle(
  line: { productName: string; sellUnitLabel?: string | null },
  index: number,
): string {
  return `${index}. ${formatReceiptProductName(line)}`;
}
