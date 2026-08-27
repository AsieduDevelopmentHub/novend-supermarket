/** Catalog prices applied when a wholesale purchase is recorded. */
export function nextCatalogPrices(args: {
  unitCost: number;
  sellingPrice?: number;
  currentSelling: number;
}): { costPrice: number; sellingPrice: number } {
  return {
    costPrice: args.unitCost,
    sellingPrice: args.sellingPrice ?? args.currentSelling,
  };
}
