/**
 * Typed feature registry for platform entitlements.
 *
 * Feature keys are closed: unknown strings must never become entitlements.
 * Plan capabilities, templates, and organization overrides all resolve against
 * this registry. Backend ops listed here are documentation of enforcement points;
 * authoritative checks remain in Convex mutations/queries.
 */

import { v } from "convex/values";

export const FEATURE_KEYS = [
  "billing.view",
  "billing.selfServeCheckout",
  "products.images",
  "products.editStock",
  "inventory.wholesale",
  "branches.multiBranch",
  "reports.advanced",
  "reports.pdf",
  "reports.xlsx",
  "staff.compensation",
  "customerDisplay",
  "cloud.backup",
  "cloud.remoteMonitoring",
  "imports.products",
  "exports.reports",
  "sms.notifications",
  "sms.staff",
  "sms.customers",
  "sms.salaryAlerts",
  "sms.orgConfig",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureCategory =
  | "billing"
  | "commerce"
  | "inventory"
  | "branches"
  | "reports"
  | "staff"
  | "hardware"
  | "cloud"
  | "imports"
  | "exports"
  | "sms";

export type FeatureOfflineBehavior = "enforce" | "cache_last" | "local_ok";

export type FeatureDefinition = {
  key: FeatureKey;
  label: string;
  description: string;
  category: FeatureCategory;
  /** Secure default when no plan/template/offer/org value applies. */
  defaultEnabled: boolean;
  prerequisites: FeatureKey[];
  offlineBehavior: FeatureOfflineBehavior;
  routes: string[];
  backendOps: string[];
};

export const FEATURE_REGISTRY: Record<FeatureKey, FeatureDefinition> = {
  "billing.view": {
    key: "billing.view",
    label: "Billing page",
    description: "Show the Billing section and tenant billing routes.",
    category: "billing",
    defaultEnabled: true,
    prerequisites: [],
    offlineBehavior: "cache_last",
    routes: ["/settings"],
    backendOps: ["billing.listHistory", "billing.getSubscription"],
  },
  "billing.selfServeCheckout": {
    key: "billing.selfServeCheckout",
    label: "Self-serve checkout",
    description: "Allow the organization to start Paystack checkout for public plans.",
    category: "billing",
    defaultEnabled: false,
    prerequisites: ["billing.view"],
    offlineBehavior: "enforce",
    routes: ["/settings"],
    backendOps: ["billing.initializeCheckout", "billing.verifyPayment"],
  },
  "products.images": {
    key: "products.images",
    label: "Product images",
    description: "Upload and display product catalog images.",
    category: "commerce",
    defaultEnabled: true,
    prerequisites: [],
    offlineBehavior: "cache_last",
    routes: ["/products"],
    backendOps: ["storageUploads.createProductImageSession", "products.update"],
  },
  "products.editStock": {
    key: "products.editStock",
    label: "Edit product stock",
    description:
      "Ops escape hatch: set branch stock from the product edit form (recorded as an inventory adjustment). Off by default.",
    category: "commerce",
    defaultEnabled: false,
    prerequisites: [],
    offlineBehavior: "cache_last",
    routes: ["/products"],
    backendOps: ["products.updateProduct"],
  },
  "inventory.wholesale": {
    key: "inventory.wholesale",
    label: "Wholesale inventory",
    description: "Wholesale stock, packs/cartons, and wholesale receive/issue.",
    category: "inventory",
    defaultEnabled: false,
    prerequisites: [],
    offlineBehavior: "enforce",
    routes: ["/wholesale"],
    backendOps: ["wholesale.*"],
  },
  "branches.multiBranch": {
    key: "branches.multiBranch",
    label: "Multi-branch",
    description: "Create and manage more than one branch, including transfers.",
    category: "branches",
    defaultEnabled: false,
    prerequisites: [],
    offlineBehavior: "enforce",
    routes: ["/branches"],
    backendOps: ["branches.create", "stockTransfers.*"],
  },
  "reports.advanced": {
    key: "reports.advanced",
    label: "Advanced reports",
    description: "Advanced analytics and richer report metrics.",
    category: "reports",
    defaultEnabled: false,
    prerequisites: [],
    offlineBehavior: "cache_last",
    routes: ["/reports", "/analytics"],
    backendOps: ["analytics.*", "reports.*"],
  },
  "reports.pdf": {
    key: "reports.pdf",
    label: "PDF export",
    description: "Export reports as PDF.",
    category: "reports",
    defaultEnabled: false,
    prerequisites: ["exports.reports"],
    offlineBehavior: "enforce",
    routes: ["/reports", "/analytics"],
    backendOps: ["exportEvents.insert"],
  },
  "reports.xlsx": {
    key: "reports.xlsx",
    label: "Excel export",
    description: "Export reports as XLSX.",
    category: "reports",
    defaultEnabled: false,
    prerequisites: ["exports.reports"],
    offlineBehavior: "enforce",
    routes: ["/reports", "/analytics"],
    backendOps: ["exportEvents.insert"],
  },
  "staff.compensation": {
    key: "staff.compensation",
    label: "Staff compensation",
    description: "Salary, commission, and payroll records for staff.",
    category: "staff",
    defaultEnabled: false,
    prerequisites: [],
    offlineBehavior: "enforce",
    routes: ["/users", "/settings"],
    backendOps: ["payroll.*"],
  },
  customerDisplay: {
    key: "customerDisplay",
    label: "Customer display",
    description: "Customer-facing second screen during checkout.",
    category: "hardware",
    defaultEnabled: false,
    prerequisites: [],
    offlineBehavior: "local_ok",
    routes: ["/customer-display", "/sales"],
    backendOps: ["settings.get", "settings.set"],
  },
  "cloud.backup": {
    key: "cloud.backup",
    label: "Cloud backup",
    description: "Upload and restore organization cloud backups.",
    category: "cloud",
    defaultEnabled: true,
    prerequisites: [],
    offlineBehavior: "enforce",
    routes: ["/settings"],
    backendOps: ["cloudBackups.*"],
  },
  "cloud.remoteMonitoring": {
    key: "cloud.remoteMonitoring",
    label: "Remote monitoring",
    description: "Send heartbeats and platform telemetry from devices.",
    category: "cloud",
    defaultEnabled: true,
    prerequisites: [],
    offlineBehavior: "cache_last",
    routes: [],
    backendOps: ["platformMonitoring.*", "devices.heartbeat"],
  },
  "imports.products": {
    key: "imports.products",
    label: "Product import",
    description: "Import products from CSV/spreadsheet files.",
    category: "imports",
    defaultEnabled: true,
    prerequisites: [],
    offlineBehavior: "enforce",
    routes: ["/products"],
    backendOps: ["imports.*"],
  },
  "exports.reports": {
    key: "exports.reports",
    label: "Report export",
    description: "Export report data (CSV/JSON and gated formats).",
    category: "exports",
    defaultEnabled: true,
    prerequisites: [],
    offlineBehavior: "enforce",
    routes: ["/reports", "/analytics"],
    backendOps: ["exportEvents.insert"],
  },
  "sms.notifications": {
    key: "sms.notifications",
    label: "SMS notifications",
    description: "Operational SMS digests and alerts (for example daily sales summaries).",
    category: "sms",
    defaultEnabled: true,
    prerequisites: [],
    offlineBehavior: "enforce",
    routes: ["/settings"],
    backendOps: ["sms.*", "dailySalesDigest.*"],
  },
  "sms.staff": {
    key: "sms.staff",
    label: "Staff SMS",
    description: "SMS to cashiers and staff (clock-in alerts and staff messaging).",
    category: "sms",
    defaultEnabled: false,
    prerequisites: ["sms.notifications"],
    offlineBehavior: "enforce",
    routes: ["/users", "/settings"],
    backendOps: ["sms.notifyCashierClockIn"],
  },
  "sms.customers": {
    key: "sms.customers",
    label: "Customer SMS",
    description: "Opt-in SMS to customers (receipts, pickup, reminders).",
    category: "sms",
    defaultEnabled: false,
    prerequisites: ["sms.notifications"],
    offlineBehavior: "enforce",
    routes: ["/customers", "/settings"],
    backendOps: ["sms.*"],
  },
  "sms.salaryAlerts": {
    key: "sms.salaryAlerts",
    label: "Salary & commission SMS",
    description:
      "SMS alerts when salary or commission payments are recorded for staff — not order checkout payments.",
    category: "sms",
    defaultEnabled: false,
    prerequisites: ["sms.notifications", "staff.compensation"],
    offlineBehavior: "enforce",
    routes: ["/users", "/settings"],
    backendOps: ["sms.notifyPayrollPayment", "payroll.paySalary", "payroll.payCommission"],
  },
  "sms.orgConfig": {
    key: "sms.orgConfig",
    label: "Organization SMS configuration",
    description: "Per-organization SMS settings, templates, and mute rules.",
    category: "sms",
    defaultEnabled: false,
    prerequisites: ["sms.notifications"],
    offlineBehavior: "enforce",
    routes: ["/settings"],
    backendOps: ["settings.*"],
  },
};

export const featureKeyValidator = v.union(
  v.literal("billing.view"),
  v.literal("billing.selfServeCheckout"),
  v.literal("products.images"),
  v.literal("products.editStock"),
  v.literal("inventory.wholesale"),
  v.literal("branches.multiBranch"),
  v.literal("reports.advanced"),
  v.literal("reports.pdf"),
  v.literal("reports.xlsx"),
  v.literal("staff.compensation"),
  v.literal("customerDisplay"),
  v.literal("cloud.backup"),
  v.literal("cloud.remoteMonitoring"),
  v.literal("imports.products"),
  v.literal("exports.reports"),
  v.literal("sms.notifications"),
  v.literal("sms.staff"),
  v.literal("sms.customers"),
  v.literal("sms.salaryAlerts"),
  v.literal("sms.orgConfig"),
);

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && (FEATURE_KEYS as readonly string[]).includes(value);
}

export function featureDefinition(key: FeatureKey): FeatureDefinition {
  return FEATURE_REGISTRY[key];
}
