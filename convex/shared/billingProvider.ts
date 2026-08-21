/**
 * Billing provider abstraction.
 *
 * The UI and the billing mutations never talk to a gateway directly — they ask
 * the active provider. `manual` activates licences that were paid for offline
 * (bank transfer, direct sale); `paystack` runs card and mobile money checkout.
 * Adding Stripe later means adding one implementation here.
 */

import type { BillingCycle, PlanKey } from "./plans";
import {
  disableSubscription,
  initializeTransaction,
  isPaystackConfigured,
  verifyTransaction,
  type PaystackTransaction,
} from "./paystack";

export type BillingProviderId = "manual" | "paystack";

export type CheckoutRequest = {
  email: string;
  planKey: PlanKey;
  cycle: BillingCycle;
  /** Major units in the organization currency. */
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  /** Gateway plan code for recurring cycles. */
  planCode?: string;
  metadata: Record<string, unknown>;
};

export type CheckoutResult =
  | { kind: "redirect"; reference: string; url: string }
  | { kind: "activated"; reference: string };

export type PaymentVerification = {
  paid: boolean;
  reference: string;
  /** Major units actually charged. */
  amount: number;
  currency: string;
  paidAt: number | null;
  gatewayCustomerCode: string | null;
  gatewayPlanCode: string | null;
  metadata: Record<string, unknown>;
};

export type CancelRequest = {
  gatewaySubscriptionCode?: string | null;
  gatewayEmailToken?: string | null;
};

export interface BillingProvider {
  readonly id: BillingProviderId;
  readonly supportsRecurring: boolean;
  createSubscription(request: CheckoutRequest): Promise<CheckoutResult>;
  verifyPayment(reference: string): Promise<PaymentVerification>;
  cancelSubscription(request: CancelRequest): Promise<void>;
  renewSubscription(request: CheckoutRequest): Promise<CheckoutResult>;
}

function toMajorUnits(subunits: number): number {
  return Math.round(subunits) / 100;
}

function readMetadata(transaction: PaystackTransaction): Record<string, unknown> {
  const raw = transaction.metadata;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw;
}

const paystackProvider: BillingProvider = {
  id: "paystack",
  supportsRecurring: true,
  async createSubscription(request) {
    const result = await initializeTransaction({
      email: request.email,
      amount: request.amount,
      currency: request.currency,
      reference: request.reference,
      callbackUrl: request.callbackUrl,
      planCode: request.planCode,
      metadata: request.metadata,
    });
    return { kind: "redirect", reference: result.reference, url: result.authorization_url };
  },
  async verifyPayment(reference) {
    const transaction = await verifyTransaction(reference);
    const planCode =
      typeof transaction.plan === "string"
        ? transaction.plan
        : (transaction.plan?.plan_code ?? null);
    return {
      paid: transaction.status === "success",
      reference: transaction.reference,
      amount: toMajorUnits(transaction.amount),
      currency: transaction.currency,
      paidAt: transaction.paid_at ? new Date(transaction.paid_at).getTime() : null,
      gatewayCustomerCode: transaction.customer?.customer_code ?? null,
      gatewayPlanCode: planCode || null,
      metadata: readMetadata(transaction),
    };
  },
  async cancelSubscription(request) {
    if (!request.gatewaySubscriptionCode || !request.gatewayEmailToken) return;
    await disableSubscription({
      code: request.gatewaySubscriptionCode,
      token: request.gatewayEmailToken,
    });
  },
  async renewSubscription(request) {
    return await this.createSubscription(request);
  },
};

/**
 * Used when no gateway is configured. Checkout activates immediately so a
 * platform admin can sell a licence directly and still get correct entitlements,
 * subscription records and billing history.
 */
const manualProvider: BillingProvider = {
  id: "manual",
  supportsRecurring: false,
  async createSubscription(request) {
    return { kind: "activated", reference: request.reference };
  },
  async verifyPayment(reference) {
    return {
      paid: true,
      reference,
      amount: 0,
      currency: "GHS",
      paidAt: Date.now(),
      gatewayCustomerCode: null,
      gatewayPlanCode: null,
      metadata: {},
    };
  },
  async cancelSubscription() {
    /* nothing to cancel with an external gateway */
  },
  async renewSubscription(request) {
    return { kind: "activated", reference: request.reference };
  },
};

export function getBillingProvider(id?: BillingProviderId): BillingProvider {
  if (id === "manual") return manualProvider;
  if (id === "paystack") return paystackProvider;
  return isPaystackConfigured() ? paystackProvider : manualProvider;
}

export function activeProviderId(): BillingProviderId {
  return isPaystackConfigured() ? "paystack" : "manual";
}
