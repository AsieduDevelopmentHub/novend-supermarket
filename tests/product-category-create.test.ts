import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  matchActiveCategoryByName,
  resolveLocalCategoryToServerId,
} from "@/lib/offline/replica-writes";
import { sortOutboxForDrain } from "@/lib/offline/sync-engine";

describe("product category on create", () => {
  it("reuses an active category with the same name", () => {
    expect(
      matchActiveCategoryByName(
        [
          { id: "cat_drinks", name: "Drinks", isActive: true },
          { id: "cat_old", name: "Drinks", isActive: false },
        ],
        " drinks ",
      ),
    ).toBe("cat_drinks");
  });

  it("returns null when the typed name is new", () => {
    expect(matchActiveCategoryByName([{ id: "cat_1", name: "Snacks" }], "Drinks")).toBeNull();
  });

  it("prefers a server category id over a local duplicate name", () => {
    expect(
      matchActiveCategoryByName(
        [
          { id: "local_new", name: "Drinks", isActive: true },
          { id: "cat_drinks", name: "Drinks", isActive: true },
        ],
        "Drinks",
      ),
    ).toBe("cat_drinks");
  });

  it("maps a local category onto the synced row with the same name", () => {
    expect(
      resolveLocalCategoryToServerId(
        [
          { id: "local_new", name: "Soft drinks", isActive: true },
          { id: "cat_soft", name: "Soft drinks", isActive: true },
        ],
        "local_new",
      ),
    ).toBe("cat_soft");
  });

  it("uses the product categoryName when the local category row is gone", () => {
    expect(
      resolveLocalCategoryToServerId(
        [{ id: "cat_soft", name: "Soft drinks", isActive: true }],
        "local_gone",
        "Soft drinks",
      ),
    ).toBe("cat_soft");
  });

  it("drains create_category before the product that depends on it", () => {
    const ordered = sortOutboxForDrain([
      { type: "upsert_product", createdAt: 1 },
      { type: "create_category", createdAt: 2 },
    ] as never);
    expect(ordered.map((row) => row.type)).toEqual(["create_category", "upsert_product"]);
  });

  it("assigns a typed new category when the product is saved", () => {
    const source = readFileSync(
      resolve(process.cwd(), "features/products/components/product-form-dialog.tsx"),
      "utf8",
    );
    expect(source).toContain("resolveCategoryIdForProduct");
    expect(source).toContain('typedName: showNewCategory ? newCategory : ""');
    expect(source).not.toContain("if (!categoryId) {");
  });

  it("rekeys Dexie products after the category syncs", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/offline/sync-engine.ts"), "utf8");
    expect(source).toContain(
      "await rekeyCategoryReferences(db, payload.localId, String(id), payload.name)",
    );
    expect(source).toContain("resolveLocalCategoryToServerId");
    expect(source).toContain("isSyncDependencyWait");
  });

  it("persists categoryName and branch stock when saving a product locally", () => {
    const form = readFileSync(
      resolve(process.cwd(), "features/products/components/product-form-dialog.tsx"),
      "utf8",
    );
    const writes = readFileSync(resolve(process.cwd(), "lib/offline/replica-writes.ts"), "utf8");
    expect(form).toContain("categoryName: resolvedCategoryName");
    expect(form).toContain("branchId: profileBranchId");
    expect(writes).toContain("resolveCategoryNameForProduct");
    expect(writes).toContain("payload.categoryName");
  });
});
