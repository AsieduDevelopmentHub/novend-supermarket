import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { featureKeyValidator } from "./shared/features";
import { paymentMethodValidator } from "./shared/paymentMethod";

export const roleValidator = v.union(
  v.literal("administrator"),
  v.literal("manager"),
  v.literal("cashier"),
);

export const expenseCategoryValidator = v.union(
  v.literal("salaries"),
  v.literal("commissions"),
  v.literal("transport"),
  v.literal("utilities"),
  v.literal("supplies"),
  v.literal("maintenance"),
  v.literal("misc"),
);

export const payrollSourceKindValidator = v.union(
  v.literal("manual"),
  v.literal("salary"),
  v.literal("commission"),
);

export const expensePaymentStatusValidator = v.union(v.literal("paid"), v.literal("void"));

export const salaryFrequencyValidator = v.union(v.literal("monthly"), v.literal("weekly"));

export const commissionBasisValidator = v.union(v.literal("net"), v.literal("gross"));

/** Platform-owner operating cost categories (Novend SaaS, not tenant POS expenses). */
export const platformCostCategoryValidator = v.union(
  v.literal("hosting"),
  v.literal("convex"),
  v.literal("vercel"),
  v.literal("domains"),
  v.literal("sms"),
  v.literal("email"),
  v.literal("infrastructure"),
  v.literal("misc"),
);

export const planKeyValidator = v.union(
  v.literal("basic"),
  v.literal("pro"),
  v.literal("enterprise"),
  v.literal("lifetime"),
);

/** `inactive` is the pre-licensing value and is treated as `disabled`. */
export const organizationStatusValidator = v.union(
  v.literal("active"),
  v.literal("trial"),
  v.literal("suspended"),
  v.literal("expired"),
  v.literal("disabled"),
  v.literal("inactive"),
);

export const cloudModeValidator = v.union(
  v.literal("full_sync"),
  v.literal("backup_only"),
  v.literal("snapshot_only"),
  v.literal("local_only"),
);

/** Hours between automatic `backup_only` cloud uploads. Missing → 24. */
export const backupIntervalHoursValidator = v.union(
  v.literal(12),
  v.literal(24),
  v.literal(48),
  v.literal(168),
  v.literal(336),
  v.literal(720),
);

/** Minutes for org-wide temporary full_sync catch-up boost. Missing → platform default → 30. */
export const cloudSyncBoostTtlMinutesValidator = v.union(
  v.literal(15),
  v.literal(30),
  v.literal(45),
  v.literal(60),
  v.literal(90),
  v.literal(120),
);

export const subscriptionStatusValidator = v.union(
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("cancelled"),
  v.literal("expired"),
);

export const billingCycleValidator = v.union(
  v.literal("monthly"),
  v.literal("yearly"),
  v.literal("lifetime"),
);

export const paymentGatewayValidator = v.union(
  v.literal("none"),
  v.literal("paystack"),
  v.literal("manual"),
);

export const telemetryRuntimeValidator = v.union(
  v.literal("web"),
  v.literal("pwa"),
  v.literal("electron"),
  v.literal("android"),
  v.literal("ios"),
);

export const telemetryEventKindValidator = v.union(
  v.literal("feature_used"),
  v.literal("workflow_completed"),
  v.literal("client_error"),
  v.literal("sync_health"),
  v.literal("release_download"),
  v.literal("release_update_check"),
  v.literal("platform_admin_export"),
);

export const tourStatusValidator = v.union(
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("skipped"),
);

export const tourProgressEntryValidator = v.object({
  tourId: v.string(),
  version: v.number(),
  status: tourStatusValidator,
  lastStepId: v.optional(v.string()),
  startedAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
});

export const scheduledChangeValidator = v.object({
  type: v.literal("downgrade"),
  targetPlanKey: planKeyValidator,
  targetCycle: billingCycleValidator,
  effectiveAt: v.number(),
  createdAt: v.number(),
  status: v.literal("scheduled"),
});

/** Distinguishes billing-history rows. A scheduled downgrade is not a payment. */
export const billingEventKindValidator = v.union(
  v.literal("purchase"),
  v.literal("renewal"),
  v.literal("upgrade"),
  v.literal("payment"),
  v.literal("refund"),
  v.literal("credit"),
  v.literal("failed"),
  v.literal("scheduled_downgrade"),
  v.literal("scheduled_downgrade_cancelled"),
  v.literal("scheduled_downgrade_applied"),
);

export const billingVisibilityValidator = v.union(
  v.literal("visible"),
  v.literal("hidden"),
  v.literal("custom_offer_only"),
);

export const experienceRadiusScaleValidator = v.union(
  v.literal("compact"),
  v.literal("default"),
  v.literal("soft"),
);

export const experiencePresetStatusValidator = v.union(v.literal("active"), v.literal("archived"));

export const featureTemplateStatusValidator = v.union(v.literal("active"), v.literal("archived"));

export const provisioningPolicyStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("active"),
  v.literal("retired"),
);

export const commercialOfferStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("accepted"),
  v.literal("expired"),
  v.literal("withdrawn"),
);

export const sellablePlanKeyValidator = v.union(
  v.literal("basic"),
  v.literal("pro"),
  v.literal("enterprise"),
);

/** Same shape as organizations.limitOverrides — reused by commercial offers. */
export const limitOverridesValidator = v.object({
  products: v.optional(v.union(v.number(), v.null())),
  users: v.optional(v.union(v.number(), v.null())),
  branches: v.optional(v.union(v.number(), v.null())),
  devices: v.optional(v.union(v.number(), v.null())),
});

export const experienceOverridesValidator = v.object({
  accent: v.optional(v.string()),
  accentForeground: v.optional(v.string()),
  sidebarBackground: v.optional(v.string()),
  sidebarForeground: v.optional(v.string()),
  sidebarAccent: v.optional(v.string()),
  sidebarAccentForeground: v.optional(v.string()),
});

export const featureOverrideEntryValidator = v.object({
  feature: featureKeyValidator,
  value: v.union(v.literal("inherit"), v.literal("enabled"), v.literal("disabled")),
});

export const inventoryReasonValidator = v.union(
  v.literal("sale"),
  v.literal("receive"),
  v.literal("adjustment"),
  v.literal("damage"),
  v.literal("return"),
  v.literal("expiry"),
  v.literal("seed"),
  v.literal("transfer_out"),
  v.literal("transfer_in"),
  v.literal("wholesale_receive"),
  v.literal("wholesale_issue"),
);

export default defineSchema({
  ...authTables,

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    status: organizationStatusValidator,
    ownerUserId: v.id("users"),
    currency: v.string(),
    timezone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    /** Registration country, set by the Super Admin (PEAS organization profile). */
    country: v.optional(v.string()),
    /** Legacy free-text plan label kept for older records. `planKey` is authoritative. */
    plan: v.optional(v.string()),
    planKey: v.optional(planKeyValidator),
    /** Catalog row for the active plan. Mirrors `planKey` for platform joins. */
    activePlanId: v.optional(v.id("plans")),
    subscriptionId: v.optional(v.id("subscriptions")),
    trialEndsAt: v.optional(v.number()),
    /**
     * Enterprise cloud backup quota in bytes. Ignored on plans that publish a
     * fixed backup limit. `undefined` / `null` means no cap.
     */
    backupLimitBytes: v.optional(v.union(v.number(), v.null())),
    /**
     * Super Admin overrides for metered resources, on top of the plan catalog.
     * A key present with `null` means unlimited; an absent key inherits the plan.
     */
    limitOverrides: v.optional(limitOverridesValidator),
    /**
     * Per-org cloud usage mode. Missing → treated as full_sync (no migration).
     * See docs/architecture/CLOUD_MODE_PLAN_V1.md.
     */
    cloudMode: v.optional(cloudModeValidator),
    /**
     * Temporary org-wide full_sync window so a new/empty till can pull and other
     * devices can flush. PEAS `cloudMode` is unchanged. Missing / past → no boost.
     */
    cloudSyncBoostUntil: v.optional(v.number()),
    cloudSyncBoostStartedAt: v.optional(v.number()),
    cloudSyncBoostReason: v.optional(v.string()),
    /**
     * Per-org override for catch-up boost duration (minutes). Missing / null →
     * `platformDefaults.cloudSyncBoostTtlMinutes` → 30.
     */
    cloudSyncBoostTtlMinutes: v.optional(
      v.union(cloudSyncBoostTtlMinutesValidator, v.null()),
    ),
    /**
     * Hours between automatic encrypted uploads while the org is `backup_only`
     * or `snapshot_only`. Missing → 24. Does not apply to `full_sync` (continuous)
     * or `local_only` (none).
     */
    backupIntervalHours: v.optional(backupIntervalHoursValidator),
    /**
     * Monotonic entitlement counter. Bumped whenever plan, status, limits, cloud
     * mode, backup interval, backup/monitoring, experience, features, or commercial offers change
     * so offline clients can tell their cached licence is stale. Missing → 0.
     * See docs/architecture/CLOUD_MODE_PLAN_V2.md (§38).
     */
    entitlementVersion: v.optional(v.number()),
    /**
     * Super Admin restriction of the cloud modes this organization may select.
     * Missing → every mode is allowed (current behaviour).
     */
    allowedCloudModes: v.optional(v.array(cloudModeValidator)),
    /** Platform toggle for cloud backups. Missing → enabled. */
    cloudBackupEnabled: v.optional(v.boolean()),
    /** Platform toggle for remote monitoring. Missing → enabled. */
    remoteMonitoringEnabled: v.optional(v.boolean()),
    /** Assigned experience preset (platform-owned). */
    experiencePresetId: v.optional(v.id("experiencePresets")),
    /** Negotiated color overrides on top of the assigned preset. */
    experienceOverrides: v.optional(experienceOverridesValidator),
    /** Monotonic experience counter; bumped when preset/overrides publish. */
    experienceVersion: v.optional(v.number()),
    /** Assigned feature template (platform-owned). */
    featureTemplateId: v.optional(v.id("featureTemplates")),
    /** Tri-state per-feature overrides (inherit / enabled / disabled). */
    featureOverrides: v.optional(v.array(featureOverrideEntryValidator)),
    /** Monotonic feature entitlement counter. */
    featureEntitlementVersion: v.optional(v.number()),
    /** Controls tenant Billing UI visibility. Missing → visible. */
    billingVisibility: v.optional(billingVisibilityValidator),
    /**
     * Platform-only flag: internal / QA tenants excluded from MRR, ARR, and
     * gross revenue. Missing → false (counts in commercial metrics).
     */
    isTestOrganization: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    /** Owner-initiated closure; org stays recoverable until `closureEffectiveAt`. */
    closureRequestedAt: v.optional(v.number()),
    closureEffectiveAt: v.optional(v.number()),
    closureRequestedBy: v.optional(v.id("users")),
    closureReason: v.optional(v.string()),
    closurePreviousStatus: v.optional(organizationStatusValidator),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerUserId", ["ownerUserId"])
    .index("by_status", ["status"])
    .index("by_planKey", ["planKey"])
    .index("by_cloudMode", ["cloudMode"]),

  /**
   * Platform-owned visual presets (semantic color tokens).
   * See docs/architecture/NOVEND_PLATFORM_CUSTOMIZATION_ENTITLEMENTS_CURSOR_BRIEF.md.
   */
  experiencePresets: defineTable({
    key: v.string(),
    name: v.string(),
    status: experiencePresetStatusValidator,
    accent: v.string(),
    accentForeground: v.string(),
    sidebarBackground: v.string(),
    sidebarForeground: v.string(),
    sidebarAccent: v.string(),
    sidebarAccentForeground: v.string(),
    focusRing: v.string(),
    success: v.string(),
    warning: v.string(),
    danger: v.string(),
    radiusScale: experienceRadiusScaleValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_status", ["status"]),

  /**
   * Reusable feature entitlement templates assigned to organizations.
   */
  featureTemplates: defineTable({
    key: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    values: v.array(
      v.object({
        feature: featureKeyValidator,
        enabled: v.boolean(),
      }),
    ),
    status: featureTemplateStatusValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  /**
   * Default experience/feature/plan policy for organizations created after
   * `effectiveFrom`. Existing orgs keep their snapshot until explicitly migrated.
   */
  organizationProvisioningPolicies: defineTable({
    name: v.string(),
    status: provisioningPolicyStatusValidator,
    effectiveFrom: v.number(),
    experiencePresetId: v.id("experiencePresets"),
    featureTemplateId: v.optional(v.id("featureTemplates")),
    publicPlanKey: v.optional(sellablePlanKeyValidator),
    /** Default industry pack for new orgs when the owner does not pick a type. */
    defaultIndustryProfile: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status_effectiveFrom", ["status", "effectiveFrom"]),

  /**
   * Private commercial offers (custom pricing/limits) for a single organization.
   */
  commercialOffers: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    status: commercialOfferStatusValidator,
    basePlanKey: sellablePlanKeyValidator,
    currency: v.string(),
    monthlyPrice: v.optional(v.number()),
    yearlyPrice: v.optional(v.number()),
    /** One-time commercial buyout — counts toward gross, never MRR/ARR. */
    lifetimePrice: v.optional(v.number()),
    allowedCycles: v.array(
      v.union(v.literal("monthly"), v.literal("yearly"), v.literal("lifetime")),
    ),
    limitOverrides: v.optional(limitOverridesValidator),
    featureOverrides: v.optional(
      v.array(
        v.object({
          feature: featureKeyValidator,
          enabled: v.boolean(),
        }),
      ),
    ),
    validFrom: v.number(),
    validUntil: v.optional(v.number()),
    notesInternal: v.optional(v.string()),
    customerMessage: v.optional(v.string()),
    /** Paystack recurring plan codes for this offer's custom amounts — never shared with the public catalog. */
    gatewayMonthlyPlanCode: v.optional(v.string()),
    gatewayYearlyPlanCode: v.optional(v.string()),
    createdBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"]),

  /**
   * Commercial plan catalog. Mirrors `convex/shared/plans.ts`, which stays the
   * source of truth for limits; this table adds gateway plan codes and gives the
   * platform dashboard something to join against.
   */
  plans: defineTable({
    key: planKeyValidator,
    name: v.string(),
    description: v.string(),
    monthlyPrice: v.union(v.number(), v.null()),
    yearlyPrice: v.union(v.number(), v.null()),
    oneTimePrice: v.union(v.number(), v.null()),
    currency: v.string(),
    productLimit: v.union(v.number(), v.null()),
    userLimit: v.union(v.number(), v.null()),
    branchLimit: v.union(v.number(), v.null()),
    deviceLimit: v.union(v.number(), v.null()),
    backupLimitBytes: v.union(v.number(), v.null()),
    features: v.array(v.string()),
    isLifetime: v.boolean(),
    sortOrder: v.number(),
    gatewayMonthlyPlanCode: v.optional(v.string()),
    gatewayYearlyPlanCode: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  subscriptions: defineTable({
    organizationId: v.id("organizations"),
    planKey: planKeyValidator,
    planId: v.optional(v.id("plans")),
    status: subscriptionStatusValidator,
    billingCycle: billingCycleValidator,
    isLifetime: v.boolean(),
    startsAt: v.number(),
    expiresAt: v.optional(v.number()),
    nextBillingDate: v.optional(v.number()),
    /** Full access continues until this instant after a lapse. */
    graceUntil: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    cancelledAt: v.optional(v.number()),
    amount: v.number(),
    currency: v.string(),
    paymentGateway: paymentGatewayValidator,
    gatewayCustomerCode: v.optional(v.string()),
    gatewaySubscriptionCode: v.optional(v.string()),
    gatewayEmailToken: v.optional(v.string()),
    gatewayPlanCode: v.optional(v.string()),
    /**
     * Future plan transition. Status stays `active` on the current plan until
     * `effectiveAt` — do not overload `status` with "downgrade_pending".
     */
    scheduledChange: v.optional(scheduledChangeValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_status", ["status"])
    .index("by_gatewaySubscriptionCode", ["gatewaySubscriptionCode"])
    .index("by_gatewayCustomerCode", ["gatewayCustomerCode"])
    .index("by_expiresAt", ["expiresAt"]),

  devices: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    /** Stable per-installation identifier generated on the client. */
    fingerprint: v.string(),
    platform: v.string(),
    runtime: v.union(
      v.literal("desktop"),
      v.literal("web"),
      v.literal("android"),
      v.literal("ios"),
    ),
    deliveryMode: v.optional(
      v.union(
        v.literal("browser"),
        v.literal("pwa"),
        v.literal("electron"),
        v.literal("capacitor"),
      ),
    ),
    appVersion: v.optional(v.string()),
    registeredAt: v.number(),
    lastSeenAt: v.number(),
    isActive: v.boolean(),
    deactivatedAt: v.optional(v.number()),
    deactivatedBy: v.optional(v.id("users")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_fingerprint", ["organizationId", "fingerprint"])
    .index("by_organization_active", ["organizationId", "isActive"])
    .index("by_user", ["userId"])
    .index("by_isActive", ["isActive"])
    .index("by_registeredAt", ["registeredAt"]),

  billingHistory: defineTable({
    organizationId: v.id("organizations"),
    subscriptionId: v.optional(v.id("subscriptions")),
    planKey: v.optional(planKeyValidator),
    billingCycle: v.optional(billingCycleValidator),
    amount: v.number(),
    currency: v.string(),
    gateway: paymentGatewayValidator,
    reference: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("abandoned"),
      v.literal("refunded"),
    ),
    description: v.string(),
    kind: v.optional(billingEventKindValidator),
    paidAt: v.optional(v.number()),
    initiatedBy: v.optional(v.id("users")),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_createdAt", ["organizationId", "createdAt"])
    .index("by_status_gateway_createdAt", ["status", "gateway", "createdAt"])
    .index("by_reference", ["reference"]),

  cloudBackups: defineTable({
    organizationId: v.id("organizations"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    sizeBytes: v.number(),
    kind: v.union(v.literal("manual"), v.literal("automatic"), v.literal("snapshot")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_createdAt", ["organizationId", "createdAt"]),

  platformAdmins: defineTable({
    userId: v.id("users"),
    createdAt: v.number(),
    /** owner | operator | support | analyst — missing on legacy rows means owner. */
    role: v.optional(
      v.union(
        v.literal("owner"),
        v.literal("operator"),
        v.literal("support"),
        v.literal("analyst"),
      ),
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
    createdBy: v.optional(v.id("users")),
  }).index("by_userId", ["userId"]),

  /** Novend platform operating costs (hosting, Convex, etc.) — not tenant expenses. */
  platformOperatingCosts: defineTable({
    amount: v.number(),
    currency: v.string(),
    category: platformCostCategoryValidator,
    occurredAt: v.number(),
    description: v.optional(v.string()),
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_occurredAt", ["occurredAt"])
    .index("by_category", ["category"]),

  branches: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    code: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    receiptShowName: v.optional(v.boolean()),
    receiptShowAddress: v.optional(v.boolean()),
    receiptShowPhone: v.optional(v.boolean()),
    receiptShowEmail: v.optional(v.boolean()),
    receiptPaperWidthMm: v.optional(v.union(v.literal(58), v.literal(80))),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_code", ["organizationId", "code"])
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  profiles: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    role: roleValidator,
    branch: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
    phone: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    imageStorageId: v.optional(v.id("_storage")),
    lastSeenAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    lastDevice: v.optional(v.string()),
    deactivatedAt: v.optional(v.number()),
    deactivatedBy: v.optional(v.id("users")),
    accountDeletionRequestedAt: v.optional(v.number()),
    appearanceTheme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
    appearanceFontSize: v.optional(v.union(v.literal("sm"), v.literal("md"), v.literal("lg"))),
    /** JSON SalesProductDisplay — catalog layout preference synced across devices. */
    salesProductDisplay: v.optional(v.string()),
    /** Compact denormalized copy of userTourProgress for session + snapshot bootstrap. */
    tourProgress: v.optional(v.array(tourProgressEntryValidator)),
    /** When true, in-app and device alerts for this person are held. Missing means not muted. */
    notificationsMuted: v.optional(v.boolean()),
    /** First sign-in of the business day. Later logins the same day do not move this. */
    clockedInAt: v.optional(v.number()),
    /** Business-timezone day (`YYYY-MM-DD`) for `clockedInAt`. */
    clockedInOn: v.optional(v.string()),
    /** Set once when the join welcome is claimed, so it is not sent again. */
    welcomedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_role", ["role"])
    .index("by_status", ["status"])
    .index("by_branchId", ["branchId"]),

  /** Platform SMS broadcasts. Phones are not stored — only the audience and count. */
  smsBroadcasts: defineTable({
    createdAt: v.number(),
    actorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    audiences: v.array(
      v.union(v.literal("owners"), v.literal("administrators"), v.literal("managers")),
    ),
    message: v.string(),
    recipientCount: v.number(),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    detail: v.optional(v.string()),
  }).index("by_createdAt", ["createdAt"]),

  /** Platform in-app notices. Recipient ids are not stored — only the audience and count. */
  platformNotices: defineTable({
    createdAt: v.number(),
    actorId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    audiences: v.array(
      v.union(v.literal("owners"), v.literal("administrators"), v.literal("managers")),
    ),
    title: v.string(),
    body: v.string(),
    recipientCount: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  categories: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    isActive: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_slug", ["organizationId", "slug"])
    .index("by_slug", ["slug"])
    .index("by_active", ["isActive"]),

  products: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    sku: v.string(),
    barcode: v.optional(v.string()),
    categoryId: v.id("categories"),
    costPrice: v.number(),
    sellingPrice: v.number(),
    stockQuantity: v.number(),
    unit: v.string(),
    /**
     * When false and org has `non_stock_sales`, sales skip stock check/deduct.
     * Missing / true = track inventory (default retail behavior).
     */
    tracksInventory: v.optional(v.boolean()),
    /** Optional multi-unit / weight configuration (Stage 2+). */
    sellUnits: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          factorToBase: v.number(),
          barcode: v.optional(v.string()),
          sellingPrice: v.optional(v.number()),
          active: v.boolean(),
        }),
      ),
    ),
    pricingMode: v.optional(v.union(v.literal("fixed"), v.literal("per_weight"))),
    lowStockThreshold: v.number(),
    tracksExpiry: v.optional(v.boolean()),
    expiryAlertDays: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_sku", ["organizationId", "sku"])
    .index("by_organization_barcode", ["organizationId", "barcode"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_sku", ["sku"])
    .index("by_category", ["categoryId"])
    .index("by_status", ["status"]),

  branchStock: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    productId: v.id("products"),
    quantity: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_product", ["productId"])
    .index("by_branch_product", ["branchId", "productId"]),

  inventoryHistory: defineTable({
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    branchId: v.optional(v.id("branches")),
    quantityChange: v.number(),
    quantityAfter: v.number(),
    reason: inventoryReasonValidator,
    note: v.optional(v.string()),
    performedBy: v.optional(v.id("users")),
    relatedSaleId: v.optional(v.id("sales")),
    relatedReturnId: v.optional(v.id("saleReturns")),
    relatedTransferId: v.optional(v.id("stockTransfers")),
    relatedLotId: v.optional(v.id("inventoryLots")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_product", ["productId"])
    .index("by_reason", ["reason"])
    .index("by_branch", ["branchId"]),

  inventoryLots: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    productId: v.id("products"),
    quantity: v.number(),
    expiryDate: v.string(),
    receivedAt: v.number(),
    lotCode: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_product", ["productId"])
    .index("by_branch_product", ["branchId", "productId"])
    .index("by_branch_product_expiry", ["branchId", "productId", "expiryDate"])
    .index("by_expiryDate", ["expiryDate"]),

  stockTransfers: defineTable({
    organizationId: v.id("organizations"),
    kind: v.optional(v.union(v.literal("branch"), v.literal("wholesale"))),
    fromBranchId: v.optional(v.id("branches")),
    toBranchId: v.id("branches"),
    productId: v.id("products"),
    quantity: v.number(),
    note: v.optional(v.string()),
    performedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_fromBranch", ["fromBranchId"])
    .index("by_toBranch", ["toBranchId"])
    .index("by_createdAt", ["createdAt"]),

  suppliers: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    contactName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_name", ["name"]),

  supplierPurchases: defineTable({
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    reference: v.string(),
    invoiceNumber: v.optional(v.string()),
    purchasedAt: v.number(),
    notes: v.optional(v.string()),
    itemCount: v.number(),
    totalCost: v.number(),
    /**
     * Cash already given to the supplier for this delivery.
     * Absent on rows recorded before balances: those are treated as paid in full.
     */
    amountPaid: v.optional(v.number()),
    status: v.union(v.literal("completed"), v.literal("void")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_supplier", ["supplierId"])
    .index("by_purchasedAt", ["purchasedAt"])
    .index("by_reference", ["reference"])
    .index("by_organization_reference", ["organizationId", "reference"]),

  supplierPurchaseItems: defineTable({
    organizationId: v.id("organizations"),
    purchaseId: v.id("supplierPurchases"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.number(),
    unitCost: v.number(),
    lineTotal: v.number(),
    unitSellingPrice: v.optional(v.number()),
    expiryDate: v.optional(v.string()),
  })
    .index("by_purchase", ["purchaseId"])
    .index("by_product", ["productId"]),

  supplierPayments: defineTable({
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    purchaseId: v.optional(v.id("supplierPurchases")),
    amount: v.number(),
    paidAt: v.number(),
    method: paymentMethodValidator,
    note: v.optional(v.string()),
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_supplier", ["supplierId"])
    .index("by_purchase", ["purchaseId"]),

  wholesaleStock: defineTable({
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    quantity: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_product", ["productId"])
    .index("by_organization_product", ["organizationId", "productId"]),

  wholesaleLots: defineTable({
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    quantity: v.number(),
    expiryDate: v.string(),
    receivedAt: v.number(),
    lotCode: v.optional(v.string()),
    purchaseId: v.optional(v.id("supplierPurchases")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_product", ["productId"])
    .index("by_organization_product", ["organizationId", "productId"])
    .index("by_expiryDate", ["expiryDate"]),

  sales: defineTable({
    organizationId: v.id("organizations"),
    invoiceNumber: v.string(),
    cashierId: v.id("users"),
    branchId: v.optional(v.id("branches")),
    customerId: v.optional(v.id("customers")),
    customerName: v.string(),
    subtotal: v.number(),
    discount: v.number(),
    total: v.number(),
    paymentMethod: paymentMethodValidator,
    itemCount: v.number(),
    status: v.literal("completed"),
    /** Till wall-clock when the sale completed (CCTV / business time). */
    completedAt: v.number(),
    /** Server ingest time when Convex accepted the sale (optional on legacy rows). */
    syncedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_invoice", ["organizationId", "invoiceNumber"])
    .index("by_organization_completedAt", ["organizationId", "completedAt"])
    .index("by_invoice", ["invoiceNumber"])
    .index("by_cashier", ["cashierId"])
    .index("by_completedAt", ["completedAt"])
    .index("by_customer", ["customerId"])
    .index("by_branch", ["branchId"]),

  saleItems: defineTable({
    organizationId: v.id("organizations"),
    saleId: v.id("sales"),
    productId: v.id("products"),
    productName: v.string(),
    /** Base inventory quantity deducted (canonical for stock). */
    quantity: v.number(),
    unitPrice: v.number(),
    unitCost: v.optional(v.number()),
    discount: v.number(),
    lineTotal: v.number(),
    sellUnitKey: v.optional(v.string()),
    sellUnitLabel: v.optional(v.string()),
    displayedQuantity: v.optional(v.number()),
    factorToBase: v.optional(v.number()),
    pricingMode: v.optional(v.union(v.literal("fixed"), v.literal("per_weight"))),
  })
    .index("by_sale", ["saleId"])
    .index("by_organization", ["organizationId"]),

  saleItemLots: defineTable({
    organizationId: v.id("organizations"),
    saleItemId: v.id("saleItems"),
    lotId: v.id("inventoryLots"),
    quantity: v.number(),
    expiryDate: v.string(),
  })
    .index("by_saleItem", ["saleItemId"])
    .index("by_lot", ["lotId"]),

  saleReturns: defineTable({
    organizationId: v.id("organizations"),
    returnNumber: v.string(),
    saleId: v.id("sales"),
    branchId: v.id("branches"),
    customerId: v.optional(v.id("customers")),
    customerName: v.string(),
    processedBy: v.id("users"),
    reason: v.string(),
    notes: v.optional(v.string()),
    refundAmount: v.number(),
    refundMethod: paymentMethodValidator,
    itemCount: v.number(),
    kind: v.optional(v.union(v.literal("full"), v.literal("partial"))),
    status: v.union(v.literal("completed"), v.literal("pending")),
    payload: v.string(),
    completedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_returnNumber", ["returnNumber"])
    .index("by_organization_returnNumber", ["organizationId", "returnNumber"])
    .index("by_organization_completedAt", ["organizationId", "completedAt"])
    .index("by_sale", ["saleId"])
    .index("by_branch", ["branchId"])
    .index("by_completedAt", ["completedAt"])
    .index("by_processedBy", ["processedBy"]),

  saleReturnItems: defineTable({
    organizationId: v.id("organizations"),
    returnId: v.id("saleReturns"),
    saleItemId: v.id("saleItems"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    unitCost: v.optional(v.number()),
    lineRefund: v.number(),
  })
    .index("by_return", ["returnId"])
    .index("by_saleItem", ["saleItemId"]),

  saleReturnItemLots: defineTable({
    organizationId: v.id("organizations"),
    returnItemId: v.id("saleReturnItems"),
    lotId: v.id("inventoryLots"),
    quantity: v.number(),
    expiryDate: v.string(),
  })
    .index("by_returnItem", ["returnItemId"])
    .index("by_lot", ["lotId"]),

  saleReturnClientOps: defineTable({
    organizationId: v.id("organizations"),
    clientOperationId: v.string(),
    returnId: v.id("saleReturns"),
    processedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_clientOperationId", ["clientOperationId"])
    .index("by_organization_clientOperationId", ["organizationId", "clientOperationId"]),

  /** Idempotency keys for wholesale, inventory, expenses, and other outbox mutations. */
  mutationClientOps: defineTable({
    organizationId: v.id("organizations"),
    clientOperationId: v.string(),
    kind: v.string(),
    resultJson: v.string(),
    createdAt: v.number(),
  }).index("by_organization_clientOperationId", ["organizationId", "clientOperationId"]),

  expenses: defineTable({
    organizationId: v.id("organizations"),
    amount: v.number(),
    category: expenseCategoryValidator,
    occurredAt: v.number(),
    description: v.optional(v.string()),
    recordedBy: v.id("users"),
    branchId: v.optional(v.id("branches")),
    createdAt: v.number(),
    beneficiaryProfileId: v.optional(v.id("profiles")),
    payPeriodKey: v.optional(v.string()),
    paymentStatus: v.optional(expensePaymentStatusValidator),
    sourceKind: v.optional(payrollSourceKindValidator),
  })
    .index("by_organization", ["organizationId"])
    .index("by_occurredAt", ["occurredAt"])
    .index("by_organization_occurredAt", ["organizationId", "occurredAt"])
    .index("by_category", ["category"])
    .index("by_branch", ["branchId"])
    .index("by_beneficiary", ["organizationId", "beneficiaryProfileId"])
    .index("by_org_period_source", ["organizationId", "payPeriodKey", "sourceKind"]),

  /**
   * Per-staff salary and commission configuration. Payments themselves are
   * `expenses` rows (categories salaries / commissions) so they hit P&L.
   */
  staffCompensation: defineTable({
    organizationId: v.id("organizations"),
    profileId: v.id("profiles"),
    salaryAmount: v.optional(v.number()),
    salaryFrequency: salaryFrequencyValidator,
    commissionRate: v.optional(v.number()),
    commissionBasis: commissionBasisValidator,
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_profile", ["profileId"]),

  heldSales: defineTable({
    organizationId: v.id("organizations"),
    cashierId: v.id("users"),
    branchId: v.optional(v.id("branches")),
    label: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        discount: v.number(),
      }),
    ),
    subtotal: v.number(),
    discount: v.number(),
    total: v.number(),
    heldAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_cashier", ["cashierId"])
    .index("by_branch", ["branchId"]),

  customers: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_name", ["name"])
    .index("by_phone", ["phone"])
    .index("by_status", ["status"]),

  receipts: defineTable({
    organizationId: v.id("organizations"),
    saleId: v.id("sales"),
    invoiceNumber: v.string(),
    payload: v.string(),
    createdAt: v.number(),
  })
    .index("by_sale", ["saleId"])
    .index("by_invoice", ["invoiceNumber"]),

  saleClientOps: defineTable({
    organizationId: v.id("organizations"),
    clientOperationId: v.string(),
    saleId: v.id("sales"),
    cashierId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_clientOperationId", ["clientOperationId"])
    .index("by_organization_clientOperationId", ["organizationId", "clientOperationId"]),

  settings: defineTable({
    organizationId: v.id("organizations"),
    key: v.string(),
    value: v.string(),
  })
    .index("by_key", ["key"])
    .index("by_organization_key", ["organizationId", "key"]),

  /** Completed catalog imports. Counts only — spreadsheets are never stored. */
  importJobs: defineTable({
    organizationId: v.id("organizations"),
    actorId: v.id("users"),
    kind: v.literal("products"),
    fileName: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    createdCount: v.number(),
    updatedCount: v.number(),
    skippedCount: v.number(),
    failedCount: v.number(),
    errorSummary: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.number(),
  })
    .index("by_organization_createdAt", ["organizationId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  importMappings: defineTable({
    organizationId: v.id("organizations"),
    kind: v.literal("products"),
    name: v.string(),
    mappingJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization_kind", ["organizationId", "kind"]),

  /** Format usage for Super Admin visibility. Not a billed quota. */
  exportEvents: defineTable({
    organizationId: v.id("organizations"),
    actorId: v.id("users"),
    kind: v.string(),
    format: v.string(),
    rowCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_organization_createdAt", ["organizationId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  auditLogs: defineTable({
    organizationId: v.optional(v.id("organizations")),
    actorId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_actor", ["actorId"])
    .index("by_createdAt", ["createdAt"]),

  /**
   * Privacy-limited product and operational telemetry. Values are selected from
   * server allowlists; business payloads, network addresses, and user agents are
   * never stored here. Raw rows are retained for 90 days.
   */
  platformEvents: defineTable({
    organizationId: v.optional(v.id("organizations")),
    actorId: v.optional(v.id("users")),
    kind: telemetryEventKindValidator,
    feature: v.optional(v.string()),
    action: v.optional(v.string()),
    runtime: v.optional(telemetryRuntimeValidator),
    appVersion: v.optional(v.string()),
    releaseKind: v.optional(v.union(v.literal("desktop"), v.literal("mobile"))),
    releaseVersion: v.optional(v.string()),
    assetGroup: v.optional(v.string()),
    source: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    count: v.number(),
    occurredAt: v.number(),
  })
    .index("by_kind_occurredAt", ["kind", "occurredAt"])
    .index("by_feature_occurredAt", ["feature", "occurredAt"])
    .index("by_organization_occurredAt", ["organizationId", "occurredAt"])
    .index("by_occurredAt", ["occurredAt"]),

  /** One pseudonymous row per user/day; deleted after the 90-day detail window. */
  platformDailyActiveUsers: defineTable({
    day: v.string(),
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    runtime: telemetryRuntimeValidator,
    appVersion: v.optional(v.string()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_user_day", ["userId", "day"])
    .index("by_day", ["day"])
    .index("by_organization_day", ["organizationId", "day"]),

  /** Durable aggregate series used by the Super Admin dashboard. */
  platformDailyRollups: defineTable({
    day: v.string(),
    metric: v.string(),
    dimension: v.string(),
    value: v.number(),
    updatedAt: v.number(),
  })
    .index("by_day_metric_dimension", ["day", "metric", "dimension"])
    .index("by_metric_day", ["metric", "day"]),

  /**
   * Denormalized per-org counters for Super Admin overview / org list.
   * Maintained on sale/product/user/branch/import/export mutations; backfillable.
   */
  organizationPlatformStats: defineTable({
    organizationId: v.id("organizations"),
    saleCount: v.number(),
    saleRevenueTotal: v.number(),
    productCount: v.number(),
    userCount: v.number(),
    branchCount: v.number(),
    importJobCount: v.number(),
    failedImportCount: v.number(),
    exportEventCount: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  /**
   * Deployment-wide singleton for Super Admin overview cards. One row keyed
   * `global`; maintained incrementally on organization lifecycle changes and
   * fully repairable via `platformStats.rebuild`. Avoids scanning every
   * organization on each dashboard load. See CLOUD_MODE_PLAN_V2.md (§11, §40).
   */
  platformStats: defineTable({
    key: v.literal("global"),
    organizationCount: v.number(),
    activeOrganizationCount: v.number(),
    fullSyncCount: v.number(),
    backupOnlyCount: v.number(),
    /** Missing on older singleton rows → treated as 0 until rebuild. */
    snapshotOnlyCount: v.optional(v.number()),
    localOnlyCount: v.number(),
    basicPlanCount: v.number(),
    proPlanCount: v.number(),
    enterprisePlanCount: v.number(),
    lifetimePlanCount: v.number(),
    deviceCount: v.number(),
    branchCount: v.number(),
    userCount: v.number(),
    saleCount: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  /**
   * Deployment-wide Super Admin defaults (`key: "global"`). Org fields override
   * these when set. See CLOUD_MODE_PLAN_V2.md (org-wide temporary sync boost).
   */
  platformDefaults: defineTable({
    key: v.literal("global"),
    cloudSyncBoostTtlMinutes: v.optional(cloudSyncBoostTtlMinutesValidator),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  /**
   * Minimal per-organization platform telemetry heartbeat. Separate from the
   * privacy-limited product event pipeline (`platformEvents`): this exists so
   * the platform can license, manage, and monitor organizations — including
   * `local_only` tenants that never sync business data. Deduplicated to at most
   * one row per meaningful change / 24h. See CLOUD_MODE_PLAN_V2.md (§3–§9).
   */
  platformTelemetryHeartbeats: defineTable({
    organizationId: v.id("organizations"),
    cloudMode: cloudModeValidator,
    planKey: v.optional(planKeyValidator),
    appVersion: v.optional(v.string()),
    branchCount: v.number(),
    userCount: v.number(),
    deviceCount: v.number(),
    entitlementVersion: v.number(),
    localStorageBytes: v.optional(v.number()),
    lastBackupAt: v.optional(v.number()),
    pendingSyncCount: v.optional(v.number()),
    failedSyncCount: v.optional(v.number()),
    sentAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_sentAt", ["organizationId", "sentAt"]),

  /** Imported GitHub totals at telemetry launch; local trends start from trackedAt. */
  releaseDownloadBaselines: defineTable({
    releaseKind: v.union(v.literal("desktop"), v.literal("mobile")),
    releaseVersion: v.string(),
    githubAssetId: v.number(),
    fileName: v.string(),
    assetGroup: v.string(),
    downloadCount: v.number(),
    trackedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_asset", ["releaseKind", "githubAssetId"])
    .index("by_release", ["releaseKind", "releaseVersion"]),

  /** Cross-device, versioned product-tour state for tenant and platform-only users. */
  userTourProgress: defineTable({
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    tourId: v.string(),
    version: v.number(),
    status: tourStatusValidator,
    lastStepId: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_tour", ["userId", "tourId"])
    .index("by_user", ["userId"]),

  loginAttempts: defineTable({
    purpose: v.optional(v.union(v.literal("login"), v.literal("email_change"))),
    email: v.string(),
    failedCount: v.number(),
    windowStartedAt: v.number(),
    lockedUntil: v.optional(v.number()),
    deviceBuckets: v.optional(
      v.array(
        v.object({
          key: v.string(),
          failedCount: v.number(),
          windowStartedAt: v.number(),
          lockedUntil: v.optional(v.number()),
        }),
      ),
    ),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_purpose_email", ["purpose", "email"]),

  storageUploadSessions: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    purpose: v.union(
      v.literal("productImage"),
      v.literal("profileImage"),
      v.literal("cloudBackup"),
    ),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    expiresAt: v.number(),
    claimedAt: v.optional(v.number()),
  })
    .index("by_storageId", ["storageId"])
    .index("by_organization_createdAt", ["organizationId", "createdAt"]),

  passwordResetTokens: defineTable({
    email: v.string(),
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_email_createdAt", ["email", "createdAt"]),

  emailVerificationChallenges: defineTable({
    userId: v.id("users"),
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    usedAt: v.optional(v.number()),
    attemptCount: v.number(),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_email_createdAt", ["email", "createdAt"]),

  emailVerificationState: defineTable({
    userId: v.id("users"),
    email: v.string(),
    verifiedAt: v.number(),
  }).index("by_userId", ["userId"]),

  /**
   * Desktop release metadata for auto-update and in-app downloads.
   * Binaries stay on GitHub Releases; Convex is the public discovery + redirect layer
   * so terminals never call the private GitHub API.
   */
  desktopReleases: defineTable({
    version: v.string(),
    tag: v.string(),
    channel: v.union(v.literal("stable"), v.literal("beta")),
    notes: v.string(),
    releasedAt: v.number(),
    mandatory: v.boolean(),
    githubReleaseId: v.number(),
    githubReleaseUrl: v.string(),
    githubOwner: v.string(),
    githubRepo: v.string(),
    assets: v.array(
      v.object({
        platform: v.union(v.literal("win32"), v.literal("darwin"), v.literal("linux")),
        arch: v.string(),
        fileName: v.string(),
        contentType: v.optional(v.string()),
        size: v.optional(v.number()),
        sha512: v.optional(v.string()),
        sha256: v.optional(v.string()),
        githubAssetId: v.number(),
      }),
    ),
    updaterManifests: v.object({
      latestYml: v.optional(v.string()),
      latestMacYml: v.optional(v.string()),
      latestLinuxYml: v.optional(v.string()),
    }),
    publishedAt: v.number(),
  })
    .index("by_version", ["version"])
    .index("by_tag", ["tag"])
    .index("by_channel_releasedAt", ["channel", "releasedAt"]),

  mobileReleases: defineTable({
    version: v.string(),
    tag: v.string(),
    channel: v.union(v.literal("stable"), v.literal("beta")),
    notes: v.string(),
    releasedAt: v.number(),
    mandatory: v.boolean(),
    githubReleaseId: v.number(),
    githubReleaseUrl: v.string(),
    githubOwner: v.string(),
    githubRepo: v.string(),
    storeUrls: v.object({
      android: v.optional(v.string()),
      ios: v.optional(v.string()),
    }),
    assets: v.array(
      v.object({
        platform: v.union(v.literal("android"), v.literal("ios")),
        kind: v.union(v.literal("apk"), v.literal("aab"), v.literal("ipa")),
        fileName: v.string(),
        contentType: v.optional(v.string()),
        size: v.optional(v.number()),
        sha256: v.optional(v.string()),
        githubAssetId: v.number(),
      }),
    ),
    publishedAt: v.number(),
  })
    .index("by_version", ["version"])
    .index("by_tag", ["tag"])
    .index("by_channel_releasedAt", ["channel", "releasedAt"]),

  /**
   * Remote push endpoints (Web Push / FCM / Electron foreground).
   * Topic prefs live on the device row so dispatch can filter without a second read.
   */
  pushDevices: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    platform: v.union(v.literal("web"), v.literal("capacitor"), v.literal("electron")),
    /** Web Push endpoint URL, or FCM/APNs device token, or electron device key. */
    endpoint: v.string(),
    /** Web Push subscription keys (p256dh / auth). */
    p256dh: v.optional(v.string()),
    auth: v.optional(v.string()),
    topics: v.object({
      stock_alerts: v.boolean(),
      daily_summary: v.boolean(),
      branch_transfers: v.boolean(),
      subscription_alerts: v.boolean(),
    }),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_user_endpoint", ["userId", "endpoint"])
    .index("by_endpoint", ["endpoint"]),

  /** Short-lived Electron foreground notifications (consumed by the desktop shell). */
  pushOutbox: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    topic: v.union(
      v.literal("stock_alerts"),
      v.literal("daily_summary"),
      v.literal("branch_transfers"),
      v.literal("subscription_alerts"),
    ),
    title: v.string(),
    body: v.string(),
    dataJson: v.optional(v.string()),
    createdAt: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_unconsumed", ["userId", "consumedAt"]),

  /**
   * In-app inbox. Written beside device push for operational alerts only.
   * Cleared rows stay in the table so older clients are unaffected.
   */
  appNotifications: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    topic: v.union(
      v.literal("stock_alerts"),
      v.literal("daily_summary"),
      v.literal("branch_transfers"),
      v.literal("subscription_alerts"),
      v.literal("staff_clock_in"),
      v.literal("platform_notice"),
      v.literal("welcome"),
    ),
    title: v.string(),
    body: v.string(),
    href: v.optional(v.string()),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    clearedAt: v.optional(v.number()),
  }).index("by_user_createdAt", ["userId", "createdAt"]),

  // --- Phase B dining (restaurant / bar) — settles into sales on pay ---

  diningTables: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    name: v.string(),
    code: v.optional(v.string()),
    seats: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_organization_branch", ["organizationId", "branchId"]),

  diningSessions: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    tableId: v.id("diningTables"),
    status: v.union(v.literal("open"), v.literal("closed")),
    openedBy: v.id("users"),
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
    saleId: v.optional(v.id("sales")),
    guestCount: v.optional(v.number()),
    note: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_table", ["tableId"])
    .index("by_organization_status", ["organizationId", "status"]),

  diningSessionItems: defineTable({
    organizationId: v.id("organizations"),
    sessionId: v.id("diningSessions"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    discount: v.number(),
    lineTotal: v.number(),
    /** Snapshot of selected modifiers at add time. */
    modifiersJson: v.string(),
    kitchenStatus: v.union(
      v.literal("pending"),
      v.literal("fired"),
      v.literal("ready"),
      v.literal("done"),
      v.literal("void"),
    ),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_organization", ["organizationId"]),

  modifierGroups: defineTable({
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    name: v.string(),
    required: v.boolean(),
    minSelect: v.optional(v.number()),
    maxSelect: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_organization", ["organizationId"]),

  modifierOptions: defineTable({
    organizationId: v.id("organizations"),
    groupId: v.id("modifierGroups"),
    name: v.string(),
    priceDelta: v.number(),
    sortOrder: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_organization", ["organizationId"]),

  kitchenTickets: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    sessionId: v.id("diningSessions"),
    tableName: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("ready"),
      v.literal("done"),
      v.literal("void"),
    ),
    firedBy: v.id("users"),
    firedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_session", ["sessionId"])
    .index("by_branch_status", ["branchId", "status"]),

  kitchenTicketLines: defineTable({
    organizationId: v.id("organizations"),
    ticketId: v.id("kitchenTickets"),
    sessionItemId: v.id("diningSessionItems"),
    productName: v.string(),
    quantity: v.number(),
    modifiersLabel: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_ticket", ["ticketId"])
    .index("by_organization", ["organizationId"]),

  // --- Phase C hotel folio — settles into sales on checkout ---

  hotelRooms: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    name: v.string(),
    roomType: v.optional(v.string()),
    defaultProductId: v.optional(v.id("products")),
    status: v.union(
      v.literal("available"),
      v.literal("occupied"),
      v.literal("dirty"),
      v.literal("maintenance"),
      v.literal("inactive"),
    ),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_organization_branch", ["organizationId", "branchId"])
    .index("by_organization_status", ["organizationId", "status"]),

  hotelReservations: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    roomId: v.optional(v.id("hotelRooms")),
    customerId: v.id("customers"),
    arrivalDate: v.string(),
    departureDate: v.string(),
    status: v.union(
      v.literal("booked"),
      v.literal("confirmed"),
      v.literal("checked_in"),
      v.literal("cancelled"),
      v.literal("no_show"),
    ),
    guests: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_room", ["roomId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_organization_arrival", ["organizationId", "arrivalDate"]),

  hotelStays: defineTable({
    organizationId: v.id("organizations"),
    branchId: v.id("branches"),
    roomId: v.id("hotelRooms"),
    customerId: v.id("customers"),
    reservationId: v.optional(v.id("hotelReservations")),
    status: v.union(v.literal("open"), v.literal("closed")),
    checkInAt: v.number(),
    checkOutAt: v.optional(v.number()),
    saleId: v.optional(v.id("sales")),
    notes: v.optional(v.string()),
    checkedInBy: v.id("users"),
  })
    .index("by_organization", ["organizationId"])
    .index("by_branch", ["branchId"])
    .index("by_room", ["roomId"])
    .index("by_organization_status", ["organizationId", "status"]),

  hotelFolioCharges: defineTable({
    organizationId: v.id("organizations"),
    stayId: v.id("hotelStays"),
    kind: v.union(v.literal("room"), v.literal("product"), v.literal("other")),
    productId: v.id("products"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    discount: v.number(),
    lineTotal: v.number(),
    status: v.union(v.literal("open"), v.literal("void")),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_stay", ["stayId"])
    .index("by_organization", ["organizationId"]),
});
