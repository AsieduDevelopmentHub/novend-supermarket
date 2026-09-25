/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountClosure from "../accountClosure.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as billingHttp from "../billingHttp.js";
import type * as branches from "../branches.js";
import type * as categories from "../categories.js";
import type * as cloudBackups from "../cloudBackups.js";
import type * as commercialOffers from "../commercialOffers.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as desktopReleases from "../desktopReleases.js";
import type * as devices from "../devices.js";
import type * as emailVerification from "../emailVerification.js";
import type * as experiencePresets from "../experiencePresets.js";
import type * as featureTemplates from "../featureTemplates.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as inventory from "../inventory.js";
import type * as loginGuards from "../loginGuards.js";
import type * as mobileReleases from "../mobileReleases.js";
import type * as offline from "../offline.js";
import type * as organizations from "../organizations.js";
import type * as passwordReset from "../passwordReset.js";
import type * as payroll from "../payroll.js";
import type * as platform from "../platform.js";
import type * as platformAnalytics from "../platformAnalytics.js";
import type * as platformMonitoring from "../platformMonitoring.js";
import type * as platformStats from "../platformStats.js";
import type * as products from "../products.js";
import type * as profiles from "../profiles.js";
import type * as provisioningPolicies from "../provisioningPolicies.js";
import type * as pushAlerts from "../pushAlerts.js";
import type * as pushDispatch from "../pushDispatch.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as reports from "../reports.js";
import type * as returns from "../returns.js";
import type * as sales from "../sales.js";
import type * as settings from "../settings.js";
import type * as shared_accountClosure from "../shared/accountClosure.js";
import type * as shared_accountStatus from "../shared/accountStatus.js";
import type * as shared_audit from "../shared/audit.js";
import type * as shared_auditDisplay from "../shared/auditDisplay.js";
import type * as shared_auditEnrichment from "../shared/auditEnrichment.js";
import type * as shared_billingPeriod from "../shared/billingPeriod.js";
import type * as shared_billingProvider from "../shared/billingProvider.js";
import type * as shared_branchStock from "../shared/branchStock.js";
import type * as shared_businessCapabilities from "../shared/businessCapabilities.js";
import type * as shared_capabilities from "../shared/capabilities.js";
import type * as shared_clientOps from "../shared/clientOps.js";
import type * as shared_cloudMode from "../shared/cloudMode.js";
import type * as shared_commercialOffers from "../shared/commercialOffers.js";
import type * as shared_defaultBranch from "../shared/defaultBranch.js";
import type * as shared_documentReferences from "../shared/documentReferences.js";
import type * as shared_emailLogoBase64 from "../shared/emailLogoBase64.js";
import type * as shared_emailOtp from "../shared/emailOtp.js";
import type * as shared_emailTemplates from "../shared/emailTemplates.js";
import type * as shared_emailVerificationLookup from "../shared/emailVerificationLookup.js";
import type * as shared_entitlementVersion from "../shared/entitlementVersion.js";
import type * as shared_entitlements from "../shared/entitlements.js";
import type * as shared_experience from "../shared/experience.js";
import type * as shared_features from "../shared/features.js";
import type * as shared_importExportSnapshot from "../shared/importExportSnapshot.js";
import type * as shared_licensing from "../shared/licensing.js";
import type * as shared_loginRateLimit from "../shared/loginRateLimit.js";
import type * as shared_lots from "../shared/lots.js";
import type * as shared_multiBranchBootstrap from "../shared/multiBranchBootstrap.js";
import type * as shared_notificationTopics from "../shared/notificationTopics.js";
import type * as shared_organizationConfig from "../shared/organizationConfig.js";
import type * as shared_organizationStats from "../shared/organizationStats.js";
import type * as shared_passwordPolicy from "../shared/passwordPolicy.js";
import type * as shared_passwordResetCrypto from "../shared/passwordResetCrypto.js";
import type * as shared_payroll from "../shared/payroll.js";
import type * as shared_paystack from "../shared/paystack.js";
import type * as shared_permissions from "../shared/permissions.js";
import type * as shared_planChange from "../shared/planChange.js";
import type * as shared_plans from "../shared/plans.js";
import type * as shared_platformRevenue from "../shared/platformRevenue.js";
import type * as shared_platformRoles from "../shared/platformRoles.js";
import type * as shared_platformStatsAggregate from "../shared/platformStatsAggregate.js";
import type * as shared_platformTelemetry from "../shared/platformTelemetry.js";
import type * as shared_presence from "../shared/presence.js";
import type * as shared_productImagesPolicy from "../shared/productImagesPolicy.js";
import type * as shared_provisionOrganization from "../shared/provisionOrganization.js";
import type * as shared_randomId from "../shared/randomId.js";
import type * as shared_returns from "../shared/returns.js";
import type * as shared_salesRange from "../shared/salesRange.js";
import type * as shared_storageSessions from "../shared/storageSessions.js";
import type * as shared_subscriptions from "../shared/subscriptions.js";
import type * as shared_tenancy from "../shared/tenancy.js";
import type * as shared_tourProgress from "../shared/tourProgress.js";
import type * as shared_transactionalEmail from "../shared/transactionalEmail.js";
import type * as shared_units from "../shared/units.js";
import type * as shared_validation from "../shared/validation.js";
import type * as storageUploads from "../storageUploads.js";
import type * as suppliers from "../suppliers.js";
import type * as telemetry from "../telemetry.js";
import type * as tours from "../tours.js";
import type * as users from "../users.js";
import type * as wholesale from "../wholesale.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountClosure: typeof accountClosure;
  analytics: typeof analytics;
  auth: typeof auth;
  billing: typeof billing;
  billingHttp: typeof billingHttp;
  branches: typeof branches;
  categories: typeof categories;
  cloudBackups: typeof cloudBackups;
  commercialOffers: typeof commercialOffers;
  crons: typeof crons;
  customers: typeof customers;
  dashboard: typeof dashboard;
  desktopReleases: typeof desktopReleases;
  devices: typeof devices;
  emailVerification: typeof emailVerification;
  experiencePresets: typeof experiencePresets;
  featureTemplates: typeof featureTemplates;
  http: typeof http;
  imports: typeof imports;
  inventory: typeof inventory;
  loginGuards: typeof loginGuards;
  mobileReleases: typeof mobileReleases;
  offline: typeof offline;
  organizations: typeof organizations;
  passwordReset: typeof passwordReset;
  payroll: typeof payroll;
  platform: typeof platform;
  platformAnalytics: typeof platformAnalytics;
  platformMonitoring: typeof platformMonitoring;
  platformStats: typeof platformStats;
  products: typeof products;
  profiles: typeof profiles;
  provisioningPolicies: typeof provisioningPolicies;
  pushAlerts: typeof pushAlerts;
  pushDispatch: typeof pushDispatch;
  pushNotifications: typeof pushNotifications;
  reports: typeof reports;
  returns: typeof returns;
  sales: typeof sales;
  settings: typeof settings;
  "shared/accountClosure": typeof shared_accountClosure;
  "shared/accountStatus": typeof shared_accountStatus;
  "shared/audit": typeof shared_audit;
  "shared/auditDisplay": typeof shared_auditDisplay;
  "shared/auditEnrichment": typeof shared_auditEnrichment;
  "shared/billingPeriod": typeof shared_billingPeriod;
  "shared/billingProvider": typeof shared_billingProvider;
  "shared/branchStock": typeof shared_branchStock;
  "shared/businessCapabilities": typeof shared_businessCapabilities;
  "shared/capabilities": typeof shared_capabilities;
  "shared/clientOps": typeof shared_clientOps;
  "shared/cloudMode": typeof shared_cloudMode;
  "shared/commercialOffers": typeof shared_commercialOffers;
  "shared/defaultBranch": typeof shared_defaultBranch;
  "shared/documentReferences": typeof shared_documentReferences;
  "shared/emailLogoBase64": typeof shared_emailLogoBase64;
  "shared/emailOtp": typeof shared_emailOtp;
  "shared/emailTemplates": typeof shared_emailTemplates;
  "shared/emailVerificationLookup": typeof shared_emailVerificationLookup;
  "shared/entitlementVersion": typeof shared_entitlementVersion;
  "shared/entitlements": typeof shared_entitlements;
  "shared/experience": typeof shared_experience;
  "shared/features": typeof shared_features;
  "shared/importExportSnapshot": typeof shared_importExportSnapshot;
  "shared/licensing": typeof shared_licensing;
  "shared/loginRateLimit": typeof shared_loginRateLimit;
  "shared/lots": typeof shared_lots;
  "shared/multiBranchBootstrap": typeof shared_multiBranchBootstrap;
  "shared/notificationTopics": typeof shared_notificationTopics;
  "shared/organizationConfig": typeof shared_organizationConfig;
  "shared/organizationStats": typeof shared_organizationStats;
  "shared/passwordPolicy": typeof shared_passwordPolicy;
  "shared/passwordResetCrypto": typeof shared_passwordResetCrypto;
  "shared/payroll": typeof shared_payroll;
  "shared/paystack": typeof shared_paystack;
  "shared/permissions": typeof shared_permissions;
  "shared/planChange": typeof shared_planChange;
  "shared/plans": typeof shared_plans;
  "shared/platformRevenue": typeof shared_platformRevenue;
  "shared/platformRoles": typeof shared_platformRoles;
  "shared/platformStatsAggregate": typeof shared_platformStatsAggregate;
  "shared/platformTelemetry": typeof shared_platformTelemetry;
  "shared/presence": typeof shared_presence;
  "shared/productImagesPolicy": typeof shared_productImagesPolicy;
  "shared/provisionOrganization": typeof shared_provisionOrganization;
  "shared/randomId": typeof shared_randomId;
  "shared/returns": typeof shared_returns;
  "shared/salesRange": typeof shared_salesRange;
  "shared/storageSessions": typeof shared_storageSessions;
  "shared/subscriptions": typeof shared_subscriptions;
  "shared/tenancy": typeof shared_tenancy;
  "shared/tourProgress": typeof shared_tourProgress;
  "shared/transactionalEmail": typeof shared_transactionalEmail;
  "shared/units": typeof shared_units;
  "shared/validation": typeof shared_validation;
  storageUploads: typeof storageUploads;
  suppliers: typeof suppliers;
  telemetry: typeof telemetry;
  tours: typeof tours;
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
