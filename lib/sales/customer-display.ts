import { roundMoney } from "@/lib/currency";

/** Cross-window customer display sync — offline-first via localStorage + BroadcastChannel. */

export const CUSTOMER_DISPLAY_STORAGE_KEY = "novend.customerDisplay.snapshot";
export const CUSTOMER_DISPLAY_CHANNEL = "novend:customer-display";
export const CUSTOMER_DISPLAY_PREFS_KEY = "novend.customerDisplay.prefs";

export type CustomerDisplayPhase = "idle" | "active" | "processing" | "complete";

export type CustomerDisplayLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
  imageUrl?: string | null;
};

export type CustomerDisplayBranding = {
  tradeName: string;
  branchName?: string | null;
  thankYouLine?: string | null;
};

export type CustomerDisplaySnapshot = {
  version: 1;
  phase: CustomerDisplayPhase;
  items: CustomerDisplayLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  discountMode: "amount" | "percent";
  discountField: number;
  customerName?: string | null;
  paymentMethod?: string | null;
  invoiceNumber?: string | null;
  completedAt?: number | null;
  branding: CustomerDisplayBranding;
  updatedAt: number;
};

export type CustomerDisplayPrefs = {
  preferredDisplayId: number | null;
};

export type CartLineInput = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
};

type ImageLookup = Record<string, string | null | undefined>;

function defaultBranding(): CustomerDisplayBranding {
  return { tradeName: "Novend POS", branchName: null, thankYouLine: null };
}

export function idleCustomerDisplaySnapshot(
  branding: CustomerDisplayBranding = defaultBranding(),
): CustomerDisplaySnapshot {
  return {
    version: 1,
    phase: "idle",
    items: [],
    itemCount: 0,
    subtotal: 0,
    discount: 0,
    total: 0,
    discountMode: "amount",
    discountField: 0,
    branding,
    updatedAt: Date.now(),
  };
}

export function buildCustomerDisplaySnapshot(input: {
  phase: CustomerDisplayPhase;
  items: CartLineInput[];
  imageByProductId?: ImageLookup;
  discountMode: "amount" | "percent";
  discountField: number;
  subtotal: number;
  cartDiscount: number;
  total: number;
  customerName?: string | null;
  paymentMethod?: string | null;
  invoiceNumber?: string | null;
  completedAt?: number | null;
  branding: CustomerDisplayBranding;
}): CustomerDisplaySnapshot {
  const lines: CustomerDisplayLine[] = input.items.map((item) => ({
    productId: item.productId,
    name: item.name,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    discount: item.discount,
    lineTotal: roundMoney(item.unitPrice * item.quantity - item.discount),
    imageUrl: input.imageByProductId?.[item.productId] ?? null,
  }));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return {
    version: 1,
    phase: input.phase,
    items: lines,
    itemCount,
    subtotal: roundMoney(input.subtotal),
    discount: roundMoney(input.cartDiscount),
    total: roundMoney(input.total),
    discountMode: input.discountMode,
    discountField: input.discountField,
    customerName: input.customerName ?? null,
    paymentMethod: input.paymentMethod ?? null,
    invoiceNumber: input.invoiceNumber ?? null,
    completedAt: input.completedAt ?? null,
    branding: input.branding,
    updatedAt: Date.now(),
  };
}

function isLine(value: unknown): value is CustomerDisplayLine {
  if (!value || typeof value !== "object") return false;
  const row = value as CustomerDisplayLine;
  return (
    typeof row.productId === "string" &&
    row.productId.length > 0 &&
    typeof row.name === "string" &&
    Number.isFinite(row.unitPrice) &&
    Number.isInteger(row.quantity) &&
    row.quantity > 0 &&
    Number.isFinite(row.discount) &&
    Number.isFinite(row.lineTotal)
  );
}

export function parseCustomerDisplaySnapshot(raw: string | null): CustomerDisplaySnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CustomerDisplaySnapshot;
    if (parsed.version !== 1) return null;
    if (
      parsed.phase !== "idle" &&
      parsed.phase !== "active" &&
      parsed.phase !== "processing" &&
      parsed.phase !== "complete"
    ) {
      return null;
    }
    if (!Array.isArray(parsed.items)) return null;
    const items = parsed.items;
    const itemsValid =
      parsed.phase === "idle" || items.length === 0 || items.every(isLine);
    if (!itemsValid) return null;
    if (!parsed.branding || typeof parsed.branding.tradeName !== "string") return null;
    const discountMode = parsed.discountMode === "percent" ? "percent" : "amount";
    return {
      version: 1,
      phase: parsed.phase,
      items: parsed.items,
      itemCount: Number.isFinite(parsed.itemCount) ? parsed.itemCount : 0,
      subtotal: Number.isFinite(parsed.subtotal) ? parsed.subtotal : 0,
      discount: Number.isFinite(parsed.discount) ? parsed.discount : 0,
      total: Number.isFinite(parsed.total) ? parsed.total : 0,
      discountMode,
      discountField: Number.isFinite(parsed.discountField) ? parsed.discountField : 0,
      customerName: parsed.customerName ?? null,
      paymentMethod: parsed.paymentMethod ?? null,
      invoiceNumber: parsed.invoiceNumber ?? null,
      completedAt: parsed.completedAt ?? null,
      branding: {
        tradeName: parsed.branding.tradeName,
        branchName: parsed.branding.branchName ?? null,
        thankYouLine: parsed.branding.thankYouLine ?? null,
      },
      updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function readCustomerDisplaySnapshot(): CustomerDisplaySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCustomerDisplaySnapshot(window.localStorage.getItem(CUSTOMER_DISPLAY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function emitChannel(snapshot: CustomerDisplaySnapshot) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    channel.postMessage(snapshot);
    channel.close();
  } catch {
    /* BroadcastChannel unavailable */
  }
}

/** Publish a snapshot to all customer display windows on this origin. */
export function publishCustomerDisplaySnapshot(snapshot: CustomerDisplaySnapshot): void {
  if (typeof window === "undefined") return;
  const payload = { ...snapshot, updatedAt: Date.now() };
  try {
    window.localStorage.setItem(CUSTOMER_DISPLAY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private browsing / quota */
  }
  emitChannel(payload);

  const bridge = window.novendDesktop;
  if (bridge?.publishCustomerDisplayState) {
    void bridge.publishCustomerDisplayState(payload);
  }
}

export function clearCustomerDisplaySnapshot(): void {
  publishCustomerDisplaySnapshot(idleCustomerDisplaySnapshot());
}

export function subscribeCustomerDisplaySnapshot(
  listener: (snapshot: CustomerDisplaySnapshot) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key !== CUSTOMER_DISPLAY_STORAGE_KEY || !event.newValue) return;
    const parsed = parseCustomerDisplaySnapshot(event.newValue);
    if (parsed) listener(parsed);
  };

  let channel: BroadcastChannel | null = null;
  const onMessage = (event: MessageEvent) => {
    const parsed = parseCustomerDisplaySnapshot(JSON.stringify(event.data));
    if (parsed) listener(parsed);
  };

  try {
    channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    channel.addEventListener("message", onMessage);
  } catch {
    channel = null;
  }

  window.addEventListener("storage", onStorage);

  const bridge = window.novendDesktop;
  const offIpc = bridge?.onCustomerDisplayState?.((raw) => {
    const parsed =
      typeof raw === "string"
        ? parseCustomerDisplaySnapshot(raw)
        : parseCustomerDisplaySnapshot(JSON.stringify(raw));
    if (parsed) listener(parsed);
  });

  const initial = readCustomerDisplaySnapshot();
  if (initial) listener(initial);

  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.removeEventListener("message", onMessage);
    channel?.close();
    offIpc?.();
  };
}

export function readCustomerDisplayPrefs(): CustomerDisplayPrefs {
  if (typeof window === "undefined") {
    return { preferredDisplayId: null };
  }
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_PREFS_KEY);
    if (!raw) return { preferredDisplayId: null };
    const parsed = JSON.parse(raw) as Partial<CustomerDisplayPrefs & { autoOpen?: boolean }>;
    return {
      preferredDisplayId:
        typeof parsed.preferredDisplayId === "number" ? parsed.preferredDisplayId : null,
    };
  } catch {
    return { preferredDisplayId: null };
  }
}

export function writeCustomerDisplayPrefs(prefs: CustomerDisplayPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOMER_DISPLAY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota */
  }
}
