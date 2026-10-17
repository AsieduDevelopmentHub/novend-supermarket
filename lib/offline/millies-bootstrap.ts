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
import { bindOfflineOrganization, getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import {
  readOrgLicenseCache,
  saveLicenseSnapshot,
  writeOrgLicenseCache,
} from "./license";
import { markOfflineSession } from "./session";
import { saveShellProfile } from "./shell-profile";
import { ensureDefaultSupermarketCategories } from "./millies-default-categories";
import { ensureMilliesVatSettingsSeeded } from "./millies-vat-settings";
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

/**
 * Perpetual local licence for Dexie-backed writes (sales, stock, till).
 * Safe to call on every shell boot — only writes when the snapshot is missing
 * (e.g. after a replica rebuild that wiped `meta`).
 */
export async function ensureMilliesBusinessLicense(input: {
  organizationId: string;
  organizationName?: string;
}): Promise<void> {
  bindOfflineOrganization(input.organizationId);
  const db = await getOfflineDb();
  if (!db) throw new Error("Local business database unavailable");

  const existing = await getMeta(db, META_KEYS.licenseSnapshot);
  if (existing?.trim()) {
    // Keep org-scoped mirror warm so cashiers share the same write grant.
    writeOrgLicenseCache(input.organizationId, existing);
    return;
  }

  const shared = readOrgLicenseCache(input.organizationId);
  if (shared?.trim()) {
    try {
      await saveLicenseSnapshot(JSON.parse(shared) as LicenseSnapshot);
      return;
    } catch {
      /* corrupt mirror — fall through and seed a fresh local lifetime grant */
    }
  }

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
    organizationName: input.organizationName || APP_BRAND,
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
}

export async function bootstrapMilliesStore(input: {
  organizationId: string;
  branchId: string;
  branchName: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  session: MilliesBootstrapSession;
}): Promise<void> {
  // Shared till replica — do not scope by user id.
  bindOfflineOrganization(input.organizationId);
  const db = await getOfflineDb();
  if (!db) throw new Error("Local business database unavailable");

  // Never replace an existing Main Store row — login used to wipe phone/address
  // and receipt show toggles, so Store receipt edits looked like they never saved.
  const existingBranch = await db.branches.get(input.branchId);
  if (existingBranch) {
    await db.branches.put({
      ...existingBranch,
      name: existingBranch.name?.trim() || input.branchName,
      code: existingBranch.code || "MAIN",
      status: "active",
      address: existingBranch.address?.trim() || input.storeAddress?.trim() || null,
      phone: existingBranch.phone?.trim() || input.storePhone?.trim() || null,
      email: existingBranch.email ?? null,
    });
  } else {
    const branch: MirroredBranch = {
      id: input.branchId,
      name: input.branchName,
      code: "MAIN",
      address: input.storeAddress?.trim() || null,
      phone: input.storePhone?.trim() || null,
      email: null,
      status: "active",
      receiptShowName: true,
      receiptShowAddress: true,
      receiptShowPhone: true,
      receiptShowEmail: false,
      receiptPaperWidthMm: 58,
    };
    await db.branches.put(branch);
  }

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

  // Seed defaults once — never wipe admin VAT / capability / print customizations on login.
  const existingCaps = await getMeta(db, META_KEYS.businessCapabilities);
  if (!existingCaps?.trim()) {
    const caps =
      configurationFromIndustryPack("supermarket", "lifetime") ?? DEFAULT_BUSINESS_CONFIGURATION;
    await setMeta(db, META_KEYS.businessCapabilities, JSON.stringify(caps));
  }
  await ensureMilliesVatSettingsSeeded();

  await ensureMilliesBusinessLicense({
    organizationId: input.organizationId,
    organizationName: input.storeName || APP_BRAND,
  });
  await ensureDefaultSupermarketCategories();

  const existingPrint = await getMeta(db, META_KEYS.printSnapshot);
  if (!existingPrint?.trim()) {
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
        paperWidthMm: 58,
        showLogo: true,
        headerText: "Millie's Supermarket",
        footerText: "Thank you for shopping with us",
        thankYouLine: "Come again soon",
        showCashier: true,
        showCustomer: false,
        showPaymentMethod: true,
        showSku: false,
      },
    };
    await setMeta(db, META_KEYS.printSnapshot, JSON.stringify(printSnapshot));
  }

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
