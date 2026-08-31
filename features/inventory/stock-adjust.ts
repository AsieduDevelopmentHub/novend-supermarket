export type StockAdjustReason = "receive" | "adjustment" | "damage" | "return";
export type StockDirection = "add" | "remove";

export function alignReasonToDirection(
  direction: StockDirection,
  reason: StockAdjustReason,
): StockAdjustReason {
  if (direction === "remove") {
    return reason === "receive" || reason === "return" ? "damage" : reason;
  }
  return reason === "damage" ? "receive" : reason;
}

export function alignDirectionToReason(
  reason: StockAdjustReason,
  direction: StockDirection,
): StockDirection {
  if (reason === "damage") return "remove";
  if (reason === "receive" || reason === "return") return "add";
  return direction;
}
