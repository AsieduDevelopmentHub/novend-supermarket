/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as billingHttp from "../billingHttp.js";
import type * as branches from "../branches.js";
import type * as categories from "../categories.js";
import type * as cloudBackups from "../cloudBackups.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as desktopReleases from "../desktopReleases.js";
import type * as devices from "../devices.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as loginGuards from "../loginGuards.js";
import type * as mobileReleases from "../mobileReleases.js";
import type * as offline from "../offline.js";
import type * as organizations from "../organizations.js";
import type * as platform from "../platform.js";
import type * as platformAnalytics from "../platformAnalytics.js";
import type * as products from "../products.js";
import type * as profiles from "../profiles.js";
import type * as reports from "../reports.js";
import type * as returns from "../returns.js";
import type * as sales from "../sales.js";
import type * as settings from "../settings.js";
import type * as shared_audit from "../shared/audit.js";
import type * as shared_billingPeriod from "../shared/billingPeriod.js";
import type * as shared_billingProvider from "../shared/billingProvider.js";
import type * as shared_branchStock from "../shared/branchStock.js";
import type * as shared_clientOps from "../shared/clientOps.js";
import type * as shared_defaultBranch from "../shared/defaultBranch.js";
import type * as shared_entitlements from "../shared/entitlements.js";
import type * as shared_licensing from "../shared/licensing.js";
import type * as shared_lots from "../shared/lots.js";
import type * as shared_multiBranchBootstrap from "../shared/multiBranchBootstrap.js";
import type * as shared_paystack from "../shared/paystack.js";
import type * as shared_permissions from "../shared/permissions.js";
import type * as shared_planChange from "../shared/planChange.js";
import type * as shared_plans from "../shared/plans.js";
import type * as shared_presence from "../shared/presence.js";
import type * as shared_provisionOrganization from "../shared/provisionOrganization.js";
import type * as shared_returns from "../shared/returns.js";
import type * as shared_subscriptions from "../shared/subscriptions.js";
import type * as shared_validation from "../shared/validation.js";
import type * as suppliers from "../suppliers.js";
import type * as users from "../users.js";
import type * as wholesale from "../wholesale.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  billing: typeof billing;
  billingHttp: typeof billingHttp;
  branches: typeof branches;
  categories: typeof categories;
  cloudBackups: typeof cloudBackups;
  crons: typeof crons;
  customers: typeof customers;
  dashboard: typeof dashboard;
  desktopReleases: typeof desktopReleases;
  devices: typeof devices;
  http: typeof http;
  inventory: typeof inventory;
  loginGuards: typeof loginGuards;
  mobileReleases: typeof mobileReleases;
  offline: typeof offline;
  organizations: typeof organizations;
  platform: typeof platform;
  platformAnalytics: typeof platformAnalytics;
  products: typeof products;
  profiles: typeof profiles;
  reports: typeof reports;
  returns: typeof returns;
  sales: typeof sales;
  settings: typeof settings;
  "shared/audit": typeof shared_audit;
  "shared/billingPeriod": typeof shared_billingPeriod;
  "shared/billingProvider": typeof shared_billingProvider;
  "shared/branchStock": typeof shared_branchStock;
  "shared/clientOps": typeof shared_clientOps;
  "shared/defaultBranch": typeof shared_defaultBranch;
  "shared/entitlements": typeof shared_entitlements;
  "shared/licensing": typeof shared_licensing;
  "shared/lots": typeof shared_lots;
  "shared/multiBranchBootstrap": typeof shared_multiBranchBootstrap;
  "shared/paystack": typeof shared_paystack;
  "shared/permissions": typeof shared_permissions;
  "shared/planChange": typeof shared_planChange;
  "shared/plans": typeof shared_plans;
  "shared/presence": typeof shared_presence;
  "shared/provisionOrganization": typeof shared_provisionOrganization;
  "shared/returns": typeof shared_returns;
  "shared/subscriptions": typeof shared_subscriptions;
  "shared/validation": typeof shared_validation;
  suppliers: typeof suppliers;
  users: typeof users;
  wholesale: typeof wholesale;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
