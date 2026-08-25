import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { fromSubunits, isPaystackConfigured, verifyWebhookSignature } from "./shared/paystack";
import { isPlanKey, type BillingCycle, type PlanKey } from "./shared/plans";

type PaystackWebhookBody = {
  event?: string;
  data?: Record<string, unknown>;
};

function readString(source: unknown, key: string): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(source: unknown, key: string): number | undefined {
  if (!source || typeof source !== "object") return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function readObject(source: unknown, key: string): Record<string, unknown> | undefined {
  if (!source || typeof source !== "object") return undefined;
  const value = (source as Record<string, unknown>)[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function readMetadata(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const raw = data?.metadata;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function readCycle(value: unknown): BillingCycle | undefined {
  return value === "monthly" || value === "yearly" || value === "lifetime" ? value : undefined;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Paystack webhook.
 *
 * Every event is signature-verified against the secret key before it can touch
 * a subscription. Unknown events are acknowledged so Paystack stops retrying.
 */
export const paystackWebhookHttp = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!isPaystackConfigured()) {
    return json({ ok: false, error: "Payments are not configured" }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return json({ ok: false, error: "Invalid signature" }, 401);
  }

  let payload: PaystackWebhookBody;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookBody;
  } catch {
    return json({ ok: false, error: "Malformed payload" }, 400);
  }

  const event = payload.event ?? "";
  const data = payload.data ?? {};

  switch (event) {
    case "charge.success": {
      const reference = readString(data, "reference");
      if (!reference) break;
      const amount = fromSubunits(readNumber(data, "amount") ?? 0);
      const currency = readString(data, "currency") ?? "GHS";
      const paidAtRaw = readString(data, "paid_at");
      const paidAt = paidAtRaw ? new Date(paidAtRaw).getTime() : undefined;
      const customerCode = readString(readObject(data, "customer"), "customer_code");
      const subscriptionCode =
        readString(readObject(data, "subscription"), "subscription_code") ??
        readString(data, "subscription_code");
      const metadata = readMetadata(data);
      const organizationId = readString(metadata, "organizationId") as
        Id<"organizations"> | undefined;
      const planKeyRaw = metadata.planKey;
      const planKey = isPlanKey(planKeyRaw) ? (planKeyRaw as PlanKey) : undefined;
      const cycle = readCycle(metadata.cycle);

      const applied = await ctx.runMutation(internal.billing.applySuccessfulPayment, {
        reference,
        organizationId,
        planKey,
        cycle,
        amount,
        currency,
        paidAt,
        gateway: "paystack",
        gatewayCustomerCode: customerCode,
        gatewaySubscriptionCode: subscriptionCode,
        gatewayPlanCode: readString(readObject(data, "plan"), "plan_code"),
      });

      if (!applied.applied) {
        // Recurring charge: no checkout row of ours, match by gateway codes.
        await ctx.runMutation(internal.billing.applyGatewayRenewal, {
          reference,
          amount,
          currency,
          paidAt,
          gatewayCustomerCode: customerCode,
          gatewaySubscriptionCode: subscriptionCode,
        });
      }
      break;
    }

    case "subscription.create":
    case "subscription.enable": {
      const subscriptionCode = readString(data, "subscription_code");
      if (!subscriptionCode) break;
      const nextPayment = readString(data, "next_payment_date");
      await ctx.runMutation(internal.billing.linkGatewaySubscription, {
        gatewaySubscriptionCode: subscriptionCode,
        gatewayEmailToken: readString(data, "email_token"),
        gatewayCustomerCode: readString(readObject(data, "customer"), "customer_code"),
        nextBillingDate: nextPayment ? new Date(nextPayment).getTime() : undefined,
      });
      break;
    }

    case "subscription.disable":
    case "subscription.not_renew": {
      const subscriptionCode = readString(data, "subscription_code");
      if (!subscriptionCode) break;
      await ctx.runMutation(internal.billing.disableGatewaySubscription, {
        gatewaySubscriptionCode: subscriptionCode,
      });
      break;
    }

    case "invoice.payment_failed": {
      const subscriptionCode =
        readString(readObject(data, "subscription"), "subscription_code") ??
        readString(data, "subscription_code");
      if (!subscriptionCode) break;
      await ctx.runMutation(internal.billing.markSubscriptionPastDue, {
        gatewaySubscriptionCode: subscriptionCode,
      });
      break;
    }

    case "charge.failed": {
      const reference = readString(data, "reference");
      if (!reference) break;
      await ctx.runMutation(internal.billing.markPaymentStatus, {
        reference,
        status: "failed",
      });
      break;
    }

    default:
      break;
  }

  return json({ ok: true, event });
});
