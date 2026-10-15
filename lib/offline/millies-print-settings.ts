/**
 * Millie's local business / receipt / branch receipt settings (Dexie only).
 */

import { APP_BRAND } from "@/constants/app";
import { MILLIES_LOCAL_BRANCH_ID, MILLIES_LOCAL_BRANCH_NAME } from "@/constants/runtime";
import type { ReceiptBusiness, ReceiptTemplateConfig } from "@/features/receipts/types";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import type { MirroredBranch, PrintSnapshot } from "./types";

export const DEFAULT_MILLIES_BUSINESS: ReceiptBusiness = {
  tradeName: APP_BRAND,
  legalName: APP_BRAND,
  address: "",
  phone: "",
  email: "",
  taxId: "",
};

export const DEFAULT_MILLIES_TEMPLATE: ReceiptTemplateConfig = {
  // Millie's tills use 58mm thermal paper — 80mm columns wrap and misalign amounts.
  paperWidthMm: 58,
  showLogo: true,
  headerText: "Millie's Supermarket",
  footerText: "Thank you for shopping with us",
  thankYouLine: "Come again soon",
  showCashier: true,
  showCustomer: false,
  showPaymentMethod: true,
  showSku: false,
};

export type MilliesBranchReceipt = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  receiptShowName: boolean;
  receiptShowAddress: boolean;
  receiptShowPhone: boolean;
  receiptShowEmail: boolean;
  receiptPaperWidthMm: 58 | 80 | null;
};

/** Strip old vendor copy that used to live in the editable footer (now fixed in constants). */
function scrubLegacyVendorCopy(text: string | undefined): string {
  const value = (text ?? "").trim();
  if (!value) return "";
  if (/^contact\s+novend$/i.test(value)) return "";
  if (/^powered by novend(\s+pos)?(\s*[-–—].*)?$/i.test(value)) return "";
  return text ?? "";
}

export async function loadMilliesPrintSnapshot(): Promise<PrintSnapshot> {
  const db = await getOfflineDb();
  if (!db) {
    return { business: DEFAULT_MILLIES_BUSINESS, template: DEFAULT_MILLIES_TEMPLATE };
  }
  const raw = await getMeta(db, META_KEYS.printSnapshot);
  if (!raw) {
    return { business: DEFAULT_MILLIES_BUSINESS, template: DEFAULT_MILLIES_TEMPLATE };
  }
  try {
    const parsed = JSON.parse(raw) as PrintSnapshot;
    const template = { ...DEFAULT_MILLIES_TEMPLATE, ...parsed.template };
    return {
      business: { ...DEFAULT_MILLIES_BUSINESS, ...parsed.business },
      template: {
        ...template,
        // Legacy installs saved 80mm; Millie's tills print 58mm and 80-col lines wrap.
        paperWidthMm: template.paperWidthMm === 80 ? 58 : template.paperWidthMm,
        footerText: scrubLegacyVendorCopy(template.footerText) || DEFAULT_MILLIES_TEMPLATE.footerText,
        thankYouLine:
          scrubLegacyVendorCopy(template.thankYouLine) || DEFAULT_MILLIES_TEMPLATE.thankYouLine,
      },
    };
  } catch {
    return { business: DEFAULT_MILLIES_BUSINESS, template: DEFAULT_MILLIES_TEMPLATE };
  }
}

export async function saveMilliesBusiness(business: ReceiptBusiness): Promise<void> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const current = await loadMilliesPrintSnapshot();
  const next: PrintSnapshot = { ...current, business };
  await setMeta(db, META_KEYS.printSnapshot, JSON.stringify(next));
}

export async function saveMilliesReceiptTemplate(template: ReceiptTemplateConfig): Promise<void> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const current = await loadMilliesPrintSnapshot();
  const next: PrintSnapshot = { ...current, template };
  await setMeta(db, META_KEYS.printSnapshot, JSON.stringify(next));
}

/** Ensure the Main Store row exists so receipt settings never require a cloud branch. */
export async function ensureMilliesMainBranch(): Promise<MirroredBranch | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const existing = await db.branches.get(MILLIES_LOCAL_BRANCH_ID);
  if (existing) return existing;
  const snap = await loadMilliesPrintSnapshot();
  const created: MirroredBranch = {
    id: MILLIES_LOCAL_BRANCH_ID,
    name: MILLIES_LOCAL_BRANCH_NAME,
    code: "MAIN",
    address: snap.business.address?.trim() || null,
    phone: snap.business.phone?.trim() || null,
    email: snap.business.email?.trim() || null,
    status: "active",
    receiptShowName: true,
    receiptShowAddress: true,
    receiptShowPhone: true,
    receiptShowEmail: Boolean(snap.business.email?.trim()),
    receiptPaperWidthMm: snap.template.paperWidthMm === 58 ? 58 : 80,
  };
  await db.branches.put(created);
  return created;
}

export async function loadMilliesBranchReceipt(
  branchId = MILLIES_LOCAL_BRANCH_ID,
): Promise<MilliesBranchReceipt | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  let branch = await db.branches.get(branchId);
  if (!branch && branchId === MILLIES_LOCAL_BRANCH_ID) {
    branch = (await ensureMilliesMainBranch()) ?? undefined;
  }
  if (!branch) return null;
  return branchToReceipt(branch);
}

function branchToReceipt(branch: MirroredBranch): MilliesBranchReceipt {
  const paper = branch.receiptPaperWidthMm;
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    email: branch.email ?? null,
    receiptShowName: branch.receiptShowName ?? true,
    receiptShowAddress: branch.receiptShowAddress ?? true,
    receiptShowPhone: branch.receiptShowPhone ?? true,
    receiptShowEmail: branch.receiptShowEmail ?? true,
    receiptPaperWidthMm: paper === 58 || paper === 80 ? paper : null,
  };
}

export async function saveMilliesBranchReceipt(input: {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  receiptShowName: boolean;
  receiptShowAddress: boolean;
  receiptShowPhone: boolean;
  receiptShowEmail: boolean;
  receiptPaperWidthMm: 58 | 80;
}): Promise<void> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  let existing = await db.branches.get(input.id);
  if (!existing && input.id === MILLIES_LOCAL_BRANCH_ID) {
    existing = (await ensureMilliesMainBranch()) ?? undefined;
  }
  if (!existing) throw new Error("Store not found on this till");
  await db.branches.put({
    ...existing,
    name: input.name.trim() || existing.name,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    receiptShowName: input.receiptShowName,
    receiptShowAddress: input.receiptShowAddress,
    receiptShowPhone: input.receiptShowPhone,
    receiptShowEmail: input.receiptShowEmail,
    receiptPaperWidthMm: input.receiptPaperWidthMm,
  });
}
