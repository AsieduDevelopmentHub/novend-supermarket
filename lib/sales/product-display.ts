/** Sales catalog layout preference (local + optional profile sync). */

export type SalesProductDisplayMode = "list" | "grid" | "icons" | "cards" | "dense";

export type SalesProductDisplayColumns = 2 | 3 | 4 | 5;

export type SalesProductDisplay = {
  mode: SalesProductDisplayMode;
  /** Preferred column count for grid-like modes when the viewport allows. */
  columns?: SalesProductDisplayColumns;
};

export const SALES_PRODUCT_DISPLAY_MODES: readonly SalesProductDisplayMode[] = [
  "list",
  "grid",
  "icons",
  "cards",
  "dense",
] as const;

export const SALES_PRODUCT_DISPLAY_COLUMNS: readonly SalesProductDisplayColumns[] = [
  2, 3, 4, 5,
] as const;

/** Matches the historical Sales catalog grid. */
export const DEFAULT_SALES_PRODUCT_DISPLAY: SalesProductDisplay = { mode: "grid" };

const STORAGE_PREFIX = "novend.sales.productDisplay.";

export function salesProductDisplayStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isSalesProductDisplayMode(value: unknown): value is SalesProductDisplayMode {
  return (
    value === "list" ||
    value === "grid" ||
    value === "icons" ||
    value === "cards" ||
    value === "dense"
  );
}

export function isSalesProductDisplayColumns(value: unknown): value is SalesProductDisplayColumns {
  return value === 2 || value === 3 || value === 4 || value === 5;
}

export function productDisplaySupportsColumns(mode: SalesProductDisplayMode): boolean {
  return mode === "grid" || mode === "icons" || mode === "cards" || mode === "dense";
}

export function parseSalesProductDisplay(raw: string | null | undefined): SalesProductDisplay {
  if (!raw?.trim()) return { ...DEFAULT_SALES_PRODUCT_DISPLAY };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SALES_PRODUCT_DISPLAY };
    const row = parsed as { mode?: unknown; columns?: unknown };
    const mode = isSalesProductDisplayMode(row.mode) ? row.mode : "grid";
    const columns = isSalesProductDisplayColumns(row.columns) ? row.columns : undefined;
    if (columns !== undefined && productDisplaySupportsColumns(mode)) {
      return { mode, columns };
    }
    return { mode };
  } catch {
    return { ...DEFAULT_SALES_PRODUCT_DISPLAY };
  }
}

export function serializeSalesProductDisplay(prefs: SalesProductDisplay): string {
  const mode = isSalesProductDisplayMode(prefs.mode) ? prefs.mode : "grid";
  const columns =
    productDisplaySupportsColumns(mode) && isSalesProductDisplayColumns(prefs.columns)
      ? prefs.columns
      : undefined;
  if (columns !== undefined) {
    return JSON.stringify({ mode, columns });
  }
  return JSON.stringify({ mode });
}

/** Minimum tile width (rem) so products stay readable and touchable. */
export function productDisplayMinTileRem(mode: SalesProductDisplayMode): number {
  switch (mode) {
    case "icons":
      return 4.75;
    case "dense":
      return 7.5;
    case "cards":
      return 11;
    case "grid":
      return 9;
    case "list":
    default:
      return 0;
  }
}

/**
 * Effective preferred column count. Dense defaults to 5 when unset.
 * List never uses columns.
 */
export function resolveProductDisplayColumns(
  prefs: SalesProductDisplay,
): SalesProductDisplayColumns | undefined {
  if (!productDisplaySupportsColumns(prefs.mode)) return undefined;
  if (isSalesProductDisplayColumns(prefs.columns)) return prefs.columns;
  if (prefs.mode === "dense") return 5;
  return undefined;
}

/**
 * CSS grid-template-columns (or empty for list).
 * Uses auto-fill + minmax so columns collapse before tiles crush.
 * When columns are set: minmax(max(minRem, 100%/N), 1fr) caps at N on wide screens.
 */
export function productDisplayGridTemplate(prefs: SalesProductDisplay): string | undefined {
  if (prefs.mode === "list") return undefined;
  const minRem = productDisplayMinTileRem(prefs.mode);
  const columns = resolveProductDisplayColumns(prefs);
  if (columns) {
    return `repeat(auto-fill, minmax(max(${minRem}rem, calc(100% / ${columns})), 1fr))`;
  }
  return `repeat(auto-fill, minmax(${minRem}rem, 1fr))`;
}

export function productDisplayContainerClass(prefs: SalesProductDisplay): string {
  if (prefs.mode === "list") {
    return "flex flex-col gap-2";
  }
  const gap =
    prefs.mode === "cards" ? "gap-3" : prefs.mode === "icons" ? "gap-2" : "gap-2 sm:gap-3";
  return `grid ${gap}`;
}

export function productDisplayTileClass(prefs: SalesProductDisplay): string {
  const base =
    "border-border hover:border-primary focus-visible:ring-ring bg-card rounded-xl border text-left shadow-sm transition focus-visible:ring-2 focus-visible:outline-none";
  switch (prefs.mode) {
    case "list":
      return `${base} flex min-h-11 items-center gap-3 p-2 sm:min-h-12 sm:p-2.5`;
    case "icons":
      return `${base} flex min-h-10 flex-col p-1.5`;
    case "cards":
      return `${base} p-3 sm:p-4`;
    case "dense":
      return `${base} p-2`;
    case "grid":
    default:
      return `${base} p-2 sm:p-3`;
  }
}

export const SALES_PRODUCT_DISPLAY_MODE_LABELS: Record<SalesProductDisplayMode, string> = {
  list: "List",
  grid: "Grid",
  icons: "Icons",
  cards: "Cards",
  dense: "Dense",
};
