/** Server rejections the cashier must review — do not retry forever in the background. */
export function isSyncBusinessConflict(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("insufficient wholesale") ||
    m.includes("insufficient stock") ||
    m.includes("product unavailable") ||
    m.includes("customer not found") ||
    m.includes("cart is empty") ||
    m.includes("cannot return") ||
    m.includes("order not found") ||
    m.includes("select at least one") ||
    m.includes("invalid") ||
    m.includes("forbidden") ||
    m.includes("not authorized") ||
    m.includes("unauthorized") ||
    m.includes("already exists") ||
    m.includes("duplicate")
  );
}
