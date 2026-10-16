/**
 * Stock adjust / restock reasons for Millie's Inventory dialog.
 * Values must stay within inventory history reasons used by adjustStock.
 */
export type StockAdjustReason =
  | "receive"
  | "adjustment"
  | "damage"
  | "return"
  | "expiry"
  | "theft";

export type StockDirection = "add" | "remove";

export type StockReasonOption = {
  value: StockAdjustReason;
  label: string;
};

/** Restock / add stock. */
export const ADD_STOCK_SELECT: StockReasonOption[] = [
  { value: "receive", label: "Supplier restock" },
  { value: "return", label: "Customer return" },
  { value: "adjustment", label: "Stock take surplus" },
];

/** Remove stock. */
export const REMOVE_STOCK_SELECT: StockReasonOption[] = [
  { value: "damage", label: "Damaged / spoilage" },
  { value: "expiry", label: "Expired write-off" },
  { value: "theft", label: "Theft / loss" },
  { value: "adjustment", label: "Stock take shortage" },
];

export function alignReasonToDirection(
  direction: StockDirection,
  reason: StockAdjustReason,
): StockAdjustReason {
  if (direction === "remove") {
    if (reason === "receive" || reason === "return") return "damage";
    return reason;
  }
  if (reason === "damage" || reason === "expiry" || reason === "theft") return "receive";
  return reason;
}

export function alignDirectionToReason(
  reason: StockAdjustReason,
  direction: StockDirection,
): StockDirection {
  if (reason === "damage" || reason === "expiry" || reason === "theft") return "remove";
  if (reason === "receive" || reason === "return") return "add";
  return direction;
}
