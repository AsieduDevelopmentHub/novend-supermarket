/**
 * Bind org Dexie replica and seed perpetual local licence + branch after setup/login.
 */

import { APP_BRAND } from "@/constants/app";
import {
  configurationFromIndustryPack,
  DEFAULT_BUSINESS_CONFIGURATION,
} from "@/convex/shared/businessCapabilities";
import { planCapabilities } from "@/convex/shared/capabilities";
import { DEFAULT_NOVEND_EXPERIENCE } from "@/convex/shared/experience";
import { defaultLicenseEntitlements, type LicenseSnapshot } from "@/convex/shared/licensing";
import { bindOfflineOrganization, getOfflineDb, META_KEYS, setMeta } from "./db";
import { saveLicenseSnapshot } from "./license";
import { markOfflineSession } from "./session";
import { saveShellProfile } from "./shell-profile";
import type { MilliesLocalRole } from "./millies-auth-db";
import type { MirroredBranch, MirroredUser } from "./types";

export type MilliesBootstrapSession = {
  id: string;
  username: string;
  displayName: string;
  role: MilliesLocalRole;
  branchId: string;
  branchName: string;
  organizationId: string;
};

export async function bootstrapMilliesStore(input: {
  organizationId: string;
  branchId: string;
  branchName: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  session: MilliesBootstrapSession;
}): Promise<void> {
  bindOfflineOrganization(input.organizationId, input.session.id);
  const db = await getOfflineDb();
  if (!db) throw new Error("Local business database unavailable");

  const branch: MirroredBranch = {
    id: input.branchId,
    name: input.branchName,
    code: "MAIN",
    address: input.storeAddress?.trim() || null,
    phone: input.storePhone?.trim() || null,
    status: "active",
  };
  await db.branches.put(branch);

  const mirroredUser: MirroredUser = {
    id: input.session.id,
    userId: input.session.id,
    name: input.session.displayName,
    role: input.session.role,
    branch: input.branchName,
    branchId: input.branchId,
    phone: null,
    status: "active",
    email: input.session.username.includes("@") ? input.session.username : null,
    imageUrl: null,
    isOwner: input.session.role === "administrator",
    isSelf: true,
  };
  await db.users.put(mirroredUser);

  const caps =
    configurationFromIndustryPack("supermarket", "lifetime") ?? DEFAULT_BUSINESS_CONFIGURATION;
  await setMeta(db, META_KEYS.businessCapabilities, JSON.stringify(caps));

  const entitlements = defaultLicenseEntitlements("lifetime");
  // Hide cloud billing / backups for this private till.
  entitlements.features = {
    ...entitlements.features,
    "billing.view": false,
    "billing.selfServeCheckout": false,
    "cloud.backup": false,
    "cloud.remoteMonitoring": false,
  };
  entitlements.billingVisibility = "hidden";

  const snapshot: LicenseSnapshot = {
    organizationId: input.organizationId,
    organizationName: input.storeName || APP_BRAND,
    planKey: "lifetime",
    planName: "Lifetime (local)",
    organizationStatus: "active",
    cloudMode: "local_only",
    plannedCloudMode: "local_only",
    syncBoostUntil: null,
    entitlementVersion: 1,
    configVersion: 1,
    allowedCloudModes: ["local_only"],
    cloudBackupEnabled: false,
    remoteMonitoringEnabled: false,
    backupIntervalHours: 24,
    subscription: {
      status: "active",
      isLifetime: true,
      expiresAt: null,
      graceUntil: null,
    },
    access: {
      state: "active",
      canRead: true,
      canWrite: true,
      reason: null,
      expiresAt: null,
    },
    limits: {
      products: null,
      users: null,
      branches: 1,
      devices: null,
      backupBytes: null,
    },
    capabilities: planCapabilities("lifetime"),
    features: entitlements.features,
    planFeatures: ["Offline POS", "Supermarket pack"],
    experience: { ...DEFAULT_NOVEND_EXPERIENCE, ...entitlements.experience },
    billingVisibility: "hidden",
    commercial: entitlements.commercial,
    issuedAt: Date.now(),
  };
  await saveLicenseSnapshot(snapshot);

  const printSnapshot = {
    business: {
      tradeName: input.storeName || APP_BRAND,
      legalName: input.storeName || APP_BRAND,
      address: input.storeAddress?.trim() || "",
      phone: input.storePhone?.trim() || "",
      email: "",
      taxId: "",
    },
    template: {
      paperWidthMm: 80,
      showLogo: true,
      headerText: "Millie's Supermarket",
      footerText: "Thank you for shopping with us",
      thankYouLine: "Come again soon",
      showCashier: true,
    },
  };
  await setMeta(db, META_KEYS.printSnapshot, JSON.stringify(printSnapshot));

  await saveShellProfile({
    userId: input.session.id,
    name: input.session.displayName,
    role: input.session.role,
    branchId: input.branchId,
    branchName: input.branchName,
    imageUrl: null,
    email: input.session.username.includes("@") ? input.session.username : null,
    phone: null,
    organizationName: input.storeName || APP_BRAND,
    organizationId: input.organizationId,
  });

  markOfflineSession({
    userId: input.session.id,
    name: input.session.displayName,
    email: input.session.username.includes("@") ? input.session.username : undefined,
    role: input.session.role,
    branchId: input.branchId,
    branchName: input.branchName,
    organizationId: input.organizationId,
    savedAt: Date.now(),
  });
}
