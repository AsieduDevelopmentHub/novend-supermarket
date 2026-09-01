import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { matchActiveCategoryByName } from "@/lib/offline/replica-writes";

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
    expect(source).toContain("await rekeyCategoryReferences(db, payload.localId, String(id))");
  });
});
