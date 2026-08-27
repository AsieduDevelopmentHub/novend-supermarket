const KEY_PREFIX = "novend.cartDraft:";

export type CartDraftItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
};

export type CartDraftCustomer = {
  id: string;
  name: string;
  phone: string | null;
};

export type CartDraft = {
  userId: string;
  branchId: string | null;
  items: CartDraftItem[];
  discountMode: "amount" | "percent";
  discountField: number;
  customer: CartDraftCustomer | null;
  savedAt: number;
};

export function cartDraftStorageKey(userId: string, branchId: string | null): string {
  return `${KEY_PREFIX}${userId}:${branchId ?? "_"}`;
}

function isItem(value: unknown): value is CartDraftItem {
  if (!value || typeof value !== "object") return false;
  const row = value as CartDraftItem;
  return (
    typeof row.productId === "string" &&
    row.productId.length > 0 &&
    typeof row.name === "string" &&
    Number.isFinite(row.unitPrice) &&
    Number.isInteger(row.quantity) &&
    row.quantity > 0 &&
    Number.isFinite(row.discount)
  );
}

export function parseCartDraft(raw: string | null, userId: string, branchId: string | null): CartDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CartDraft;
    if (parsed.userId !== userId) return null;
    if ((parsed.branchId ?? null) !== (branchId ?? null)) return null;
    if (!Array.isArray(parsed.items) || !parsed.items.every(isItem)) return null;
    const discountMode = parsed.discountMode === "percent" ? "percent" : "amount";
    const discountField = Number.isFinite(parsed.discountField) ? parsed.discountField : 0;
    const customer =
      parsed.customer &&
      typeof parsed.customer.id === "string" &&
      typeof parsed.customer.name === "string"
        ? {
            id: parsed.customer.id,
            name: parsed.customer.name,
            phone: parsed.customer.phone ?? null,
          }
        : null;
    return {
      userId,
      branchId: branchId ?? null,
      items: parsed.items,
      discountMode,
      discountField,
      customer,
      savedAt: Number.isFinite(parsed.savedAt) ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function readCartDraft(userId: string, branchId: string | null): CartDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCartDraft(
      window.sessionStorage.getItem(cartDraftStorageKey(userId, branchId)),
      userId,
      branchId,
    );
  } catch {
    return null;
  }
}

export function writeCartDraft(draft: CartDraft): void {
  if (typeof window === "undefined") return;
  const key = cartDraftStorageKey(draft.userId, draft.branchId);
  try {
    if (draft.items.length === 0 && !draft.customer && draft.discountField === 0) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* private browsing */
  }
}

/** Drop every saved cart on this tab (sign-out). */
export function clearCartDraft(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.sessionStorage.removeItem(key);
  } catch {
    /* private browsing */
  }
}
