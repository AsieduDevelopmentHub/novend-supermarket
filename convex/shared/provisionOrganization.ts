/**
 * Creates a tenant: organization, MAIN branch, default settings, and a licence.
 *
 * Used by public onboarding (Pro trial) and by the platform administrator
 * (trial or an assigned plan). Entitlements always go through startTrial /
 * activateSubscription so a new business is never left unlicensed.
 *
 * When an active organizationProvisioningPolicy exists with
 * `effectiveFrom <= now`, its experiencePresetId / featureTemplateId /
 * publicPlanKey are copied onto the new organization (future orgs only).
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { writeAuditLog } from "./audit";
import { DEFAULT_BRANCH_CODE, DEFAULT_BRANCH_NAME } from "./defaultBranch";
import { PLAN_CATALOG, supportsCycle, type BillingCycle, type PlanKey } from "./plans";
import { activateSubscription, startTrial } from "./subscriptions";
import { sanitizeOptionalText, sanitizeText, TEXT_LIMITS } from "./validation";
import { seedOrgPlatformStats } from "./organizationStats";
import { onOrganizationProvisioned } from "./platformStatsAggregate";

export function slugifyBusinessName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "business";
}

export type ProvisionLicense =
  | { kind: "trial"; planKey?: PlanKey }
  | { kind: "activate"; planKey: PlanKey; cycle?: BillingCycle };

export type ProvisionOrganizationArgs = {
  name: string;
  currency?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  email?: string;
  ownerUserId: Id<"users">;
  actorId?: Id<"users">;
  license: ProvisionLicense;
  auditAction: string;
};

/**
 * Latest active provisioning policy whose effectiveFrom is at or before `now`.
 * Returns null when none apply.
 */
export async function resolveActiveProvisioningPolicy(
  ctx: MutationCtx,
  now = Date.now(),
): Promise<Doc<"organizationProvisioningPolicies"> | null> {
  const active = await ctx.db
    .query("organizationProvisioningPolicies")
    .withIndex("by_status_effectiveFrom", (q) => q.eq("status", "active"))
    .collect();
  const applicable = active
    .filter((row) => row.effectiveFrom <= now)
    .sort((a, b) => b.effectiveFrom - a.effectiveFrom);
  return applicable[0] ?? null;
}

export async function provisionOrganization(
  ctx: MutationCtx,
  args: ProvisionOrganizationArgs,
): Promise<{ organizationId: Id<"organizations">; branchId: Id<"branches"> }> {
  const name = sanitizeText(args.name, "Business name", TEXT_LIMITS.name);
  const currency = (args.currency?.trim().toUpperCase() || "GHS").slice(0, 8);
  const phone = sanitizeOptionalText(args.phone, "Phone", TEXT_LIMITS.phone);
  const address = sanitizeOptionalText(args.address, "Address", TEXT_LIMITS.address);
  const taxId = sanitizeOptionalText(args.taxId, "Tax ID", TEXT_LIMITS.short);
  const email = sanitizeOptionalText(args.email, "Email", TEXT_LIMITS.email) ?? "";

  let slug = slugifyBusinessName(name);
  const clash = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const now = Date.now();
  const policy = await resolveActiveProvisioningPolicy(ctx, now);

  const organizationId = await ctx.db.insert("organizations", {
    name,
    slug,
    status: "active",
    ownerUserId: args.ownerUserId,
    currency,
    taxId,
    plan: "standard",
    cloudMode: "full_sync",
    entitlementVersion: 1,
    experiencePresetId: policy?.experiencePresetId,
    featureTemplateId: policy?.featureTemplateId,
    experienceVersion: policy?.experiencePresetId ? 1 : undefined,
    featureEntitlementVersion: policy?.featureTemplateId ? 1 : undefined,
    createdAt: now,
    updatedAt: now,
  });

  const branchId = await ctx.db.insert("branches", {
    organizationId,
    name: DEFAULT_BRANCH_NAME,
    code: DEFAULT_BRANCH_CODE,
    address,
    phone,
    status: "active",
    createdAt: now,
  });

  await ctx.db.insert("settings", {
    organizationId,
    key: "business.profile",
    value: JSON.stringify({
      tradeName: name,
      legalName: name,
      address: address ?? "",
      phone: phone ?? "",
      email,
      taxId: taxId ?? "",
    }),
  });
  await ctx.db.insert("settings", {
    organizationId,
    key: "receipt.template",
    value: JSON.stringify({
      paperWidthMm: 80,
      showLogo: false,
      headerText: "",
      footerText: "Goods sold are not returnable without receipt",
      thankYouLine: "Thank you for your business",
      showCashier: true,
      showCustomer: true,
      showPaymentMethod: true,
      showSku: false,
    }),
  });
  await ctx.db.insert("settings", {
    organizationId,
    key: "pos.preferences",
    value: JSON.stringify({ autoPrintReceipt: false, receiptPrintMode: "manual" }),
  });
  await ctx.db.insert("settings", {
    organizationId,
    key: "business.capabilities",
    value: JSON.stringify({
      industryProfile: "retail",
      enabledCapabilities: [],
      capabilitySettings: {},
      configurationVersion: 1,
    }),
  });

  let planKey: PlanKey;
  if (args.license.kind === "trial") {
    planKey = args.license.planKey ?? policy?.publicPlanKey ?? "pro";
    await startTrial(ctx, organizationId, planKey);
  } else {
    planKey = args.license.planKey;
    const plan = PLAN_CATALOG[planKey];
    const cycle: BillingCycle =
      args.license.cycle && supportsCycle(plan, args.license.cycle)
        ? args.license.cycle
        : plan.isLifetime
          ? "lifetime"
          : "monthly";
    await activateSubscription(ctx, {
      organizationId,
      planKey,
      cycle,
      amount: 0,
      currency,
      gateway: "manual",
      actorId: args.actorId ?? args.ownerUserId,
    });
  }

  await writeAuditLog(ctx, {
    organizationId,
    actorId: args.actorId ?? args.ownerUserId,
    action: args.auditAction,
    entityType: "organizations",
    entityId: organizationId,
    metadata: {
      planKey,
      trial: args.license.kind === "trial",
      provisioningPolicyId: policy?._id ?? null,
    },
  });

  await seedOrgPlatformStats(ctx, organizationId, { branchCount: 1 });
  await onOrganizationProvisioned(ctx, {
    planKey,
    cloudMode: "full_sync",
    status: "active",
    branchCount: 1,
  });

  return { organizationId, branchId };
}
