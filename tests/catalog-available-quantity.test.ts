import { describe, expect, it } from "vitest";
import {
  catalogAvailableQuantity,
  resolveCatalogAvailable,
} from "@/hooks/use-offline-catalog";

describe("catalogAvailableQuantity", () => {
  it("uses on-hand stock when inventory is tracked", () => {
    expect(catalogAvailableQuantity({ stockQuantity: 4, tracksInventory: true })).toBe(4);
    expect(catalogAvailableQuantity({ stockQuantity: 0 })).toBe(0);
  });

  it("treats non-stock catalogue items as unlimited", () => {
    expect(catalogAvailableQuantity({ stockQuantity: 0, tracksInventory: false })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("returns 0 when the product is missing", () => {
    expect(catalogAvailableQuantity(undefined)).toBe(0);
  });
});

describe("resolveCatalogAvailable", () => {
  it("prefers the live catalog row when present", () => {
    expect(
      resolveCatalogAvailable(
        "p1",
        [{ id: "p1", stockQuantity: 12, tracksInventory: true }],
        { p1: { stockQuantity: 99, tracksInventory: true } },
      ),
    ).toBe(12);
  });

  it("uses session hints when the product left the search window", () => {
    expect(
      resolveCatalogAvailable("p2", [{ id: "other", stockQuantity: 5 }], {
        p2: { stockQuantity: 40, tracksInventory: true },
      }),
    ).toBe(40);
  });

  it("returns 0 when neither catalog nor hint knows the product", () => {
    expect(resolveCatalogAvailable("missing", [], {})).toBe(0);
  });
});
