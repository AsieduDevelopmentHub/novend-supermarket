/**
 * Minimal Paystack REST client.
 *
 * Only the endpoints Novend needs, typed at the boundary. Runs inside Convex
 * actions and HTTP actions, so it uses `fetch` and Web Crypto only.
 */

const PAYSTACK_BASE_URL = "https://api.paystack.co";

/** Paystack works in the currency's smallest unit (pesewas for GHS). */
export function toSubunits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromSubunits(subunits: number): number {
  return Math.round(subunits) / 100;
}

export function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Online payments are not configured. Ask your administrator to finish payment setup.",
    );
  }
  return key;
}

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

type PaystackEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};

async function paystackFetch<T>(
  path: string,
  init: { method: "GET" | "POST" | "PUT"; body?: unknown },
): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${getPaystackSecretKey()}`,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await response.text();
  let payload: PaystackEnvelope<T> | null = null;
  try {
    payload = text ? (JSON.parse(text) as PaystackEnvelope<T>) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.status) {
    const message = payload?.message ?? `Paystack request failed (${response.status})`;
    throw new Error(message);
  }
  return payload.data;
}

export type PaystackInitializeResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export async function initializeTransaction(args: {
  email: string;
  /** Major units (GH₵). Converted to pesewas internally. */
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  /** Present for recurring plans. Paystack then ignores `amount` and charges the plan. */
  planCode?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitializeResult> {
  return await paystackFetch<PaystackInitializeResult>("/transaction/initialize", {
    method: "POST",
    body: {
      email: args.email,
      amount: toSubunits(args.amount),
      currency: args.currency,
      reference: args.reference,
      callback_url: args.callbackUrl,
      ...(args.planCode ? { plan: args.planCode } : {}),
      ...(args.metadata ? { metadata: args.metadata } : {}),
    },
  });
}

export type PaystackTransaction = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  customer: { id: number; email: string; customer_code: string } | null;
  plan?: { plan_code?: string } | string | null;
  metadata?: Record<string, unknown> | string | null;
};

export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  return await paystackFetch<PaystackTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
}

export type PaystackPlan = {
  id: number;
  name: string;
  plan_code: string;
  amount: number;
  interval: string;
  currency: string;
};

export async function createPlan(args: {
  name: string;
  amount: number;
  interval: "monthly" | "annually";
  currency: string;
  description?: string;
}): Promise<PaystackPlan> {
  return await paystackFetch<PaystackPlan>("/plan", {
    method: "POST",
    body: {
      name: args.name,
      amount: toSubunits(args.amount),
      interval: args.interval,
      currency: args.currency,
      ...(args.description ? { description: args.description } : {}),
    },
  });
}

export async function fetchPlan(code: string): Promise<PaystackPlan> {
  return await paystackFetch<PaystackPlan>(`/plan/${encodeURIComponent(code)}`, {
    method: "GET",
  });
}

export async function updatePlan(
  code: string,
  args: { name: string; amount: number; description?: string },
): Promise<PaystackPlan> {
  return await paystackFetch<PaystackPlan>(`/plan/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: {
      name: args.name,
      amount: toSubunits(args.amount),
      ...(args.description ? { description: args.description } : {}),
    },
  });
}

/**
 * Paystack recurring plans own the charge amount. Passing `plan` on initialize
 * ignores the `amount` field, so the gateway plan must match our catalog before
 * checkout. Creates the plan if missing; updates it when the catalog price moved.
 */
export async function ensureRecurringPlan(args: {
  existingCode?: string | null;
  name: string;
  amount: number;
  interval: "monthly" | "annually";
  currency: string;
  description: string;
}): Promise<string> {
  if (!args.existingCode) {
    const created = await createPlan({
      name: args.name,
      amount: args.amount,
      interval: args.interval,
      currency: args.currency,
      description: args.description,
    });
    return created.plan_code;
  }

  const current = await fetchPlan(args.existingCode);
  if (current.amount !== toSubunits(args.amount) || current.name !== args.name) {
    await updatePlan(args.existingCode, {
      name: args.name,
      amount: args.amount,
      description: args.description,
    });
  }
  return args.existingCode;
}

export type PaystackSubscription = {
  id: number;
  subscription_code: string;
  email_token: string;
  status: string;
  next_payment_date: string | null;
  amount: number;
  customer?: { customer_code?: string; email?: string } | null;
  plan?: { plan_code?: string } | null;
};

export async function fetchSubscription(code: string): Promise<PaystackSubscription> {
  return await paystackFetch<PaystackSubscription>(
    `/subscription/${encodeURIComponent(code)}`,
    { method: "GET" },
  );
}

export async function disableSubscription(args: {
  code: string;
  token: string;
}): Promise<{ status?: string }> {
  return await paystackFetch<{ status?: string }>("/subscription/disable", {
    method: "POST",
    body: { code: args.code, token: args.token },
  });
}

/**
 * Paystack signs webhooks with HMAC-SHA512 over the raw request body using the
 * secret key. Compared in constant time to avoid leaking the digest.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getPaystackSecretKey()),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

/** Novend-owned reference so webhook and verify paths can find our records. */
export function buildReference(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`.toUpperCase();
}

export function parseMetadata(
  metadata: PaystackTransaction["metadata"],
): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return metadata;
}
