import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSalesWorkingBranch,
  readSalesWorkingBranch,
  salesWorkingBranchStorageKey,
  writeSalesWorkingBranch,
} from "@/lib/sales/working-branch";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe("sales working branch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the admin branch per user", () => {
    vi.stubGlobal("window", {
      localStorage: memoryStorage(),
      dispatchEvent: () => true,
    });
    expect(salesWorkingBranchStorageKey("user_1")).toBe("novend.sales.workingBranch.user_1");
    writeSalesWorkingBranch("user_1", "branch_accra");
    expect(readSalesWorkingBranch("user_1")).toBe("branch_accra");
    expect(readSalesWorkingBranch("user_2")).toBeNull();
    clearSalesWorkingBranch("user_1");
    expect(readSalesWorkingBranch("user_1")).toBeNull();
  });

  it("ignores an all-branches value", () => {
    vi.stubGlobal("window", {
      localStorage: memoryStorage(),
      dispatchEvent: () => true,
    });
    writeSalesWorkingBranch("user_1", "all");
    expect(readSalesWorkingBranch("user_1")).toBeNull();
  });
});
