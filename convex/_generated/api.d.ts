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
import type * as branches from "../branches.js";
import type * as categories from "../categories.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as desktopReleases from "../desktopReleases.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as loginGuards from "../loginGuards.js";
import type * as offline from "../offline.js";
import type * as organizations from "../organizations.js";
import type * as platform from "../platform.js";
import type * as products from "../products.js";
import type * as profiles from "../profiles.js";
import type * as reports from "../reports.js";
import type * as returns from "../returns.js";
import type * as sales from "../sales.js";
import type * as settings from "../settings.js";
import type * as shared_audit from "../shared/audit.js";
import type * as shared_branchStock from "../shared/branchStock.js";
import type * as shared_defaultBranch from "../shared/defaultBranch.js";
import type * as shared_lots from "../shared/lots.js";
import type * as shared_multiBranchBootstrap from "../shared/multiBranchBootstrap.js";
import type * as shared_permissions from "../shared/permissions.js";
import type * as shared_returns from "../shared/returns.js";
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
  branches: typeof branches;
  categories: typeof categories;
  customers: typeof customers;
  dashboard: typeof dashboard;
  desktopReleases: typeof desktopReleases;
  http: typeof http;
  inventory: typeof inventory;
  loginGuards: typeof loginGuards;
  offline: typeof offline;
  organizations: typeof organizations;
  platform: typeof platform;
  products: typeof products;
  profiles: typeof profiles;
  reports: typeof reports;
  returns: typeof returns;
  sales: typeof sales;
  settings: typeof settings;
  "shared/audit": typeof shared_audit;
  "shared/branchStock": typeof shared_branchStock;
  "shared/defaultBranch": typeof shared_defaultBranch;
  "shared/lots": typeof shared_lots;
  "shared/multiBranchBootstrap": typeof shared_multiBranchBootstrap;
  "shared/permissions": typeof shared_permissions;
  "shared/returns": typeof shared_returns;
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
