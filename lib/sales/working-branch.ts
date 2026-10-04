const STORAGE_PREFIX = "novend.sales.workingBranch.";
export const SALES_WORKING_BRANCH_EVENT = "novend:sales-working-branch";

export function salesWorkingBranchStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function readSalesWorkingBranch(userId: string | null | undefined): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(salesWorkingBranchStorageKey(userId))?.trim();
    if (!value || value === "all") return null;
    return value;
  } catch {
    return null;
  }
}

export function writeSalesWorkingBranch(userId: string, branchId: string): void {
  if (typeof window === "undefined") return;
  const next = branchId.trim();
  if (!next || next === "all") return;
  try {
    window.localStorage.setItem(salesWorkingBranchStorageKey(userId), next);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(SALES_WORKING_BRANCH_EVENT));
}

export function clearSalesWorkingBranch(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(salesWorkingBranchStorageKey(userId));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(SALES_WORKING_BRANCH_EVENT));
}
