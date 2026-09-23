import { describe, expect, it } from "vitest";
import {
  DEFAULT_SALES_PRODUCT_DISPLAY,
  parseSalesProductDisplay,
  productDisplayContainerClass,
  productDisplayGridTemplate,
  productDisplayMinTileRem,
  productDisplaySupportsColumns,
  productDisplayTileClass,
  resolveProductDisplayColumns,
  salesProductDisplayStorageKey,
  serializeSalesProductDisplay,
} from "@/lib/sales/product-display";

describe("sales product display preferences", () => {
  it("keys storage by user id", () => {
    expect(salesProductDisplayStorageKey("user_1")).toBe("novend.sales.productDisplay.user_1");
  });

  it("defaults to grid when raw is missing or corrupt", () => {
    expect(parseSalesProductDisplay(null)).toEqual(DEFAULT_SALES_PRODUCT_DISPLAY);
    expect(parseSalesProductDisplay("")).toEqual(DEFAULT_SALES_PRODUCT_DISPLAY);
    expect(parseSalesProductDisplay("{")).toEqual(DEFAULT_SALES_PRODUCT_DISPLAY);
    expect(parseSalesProductDisplay(JSON.stringify({ mode: "nope" }))).toEqual({
      mode: "grid",
    });
  });

  it("parses mode and optional columns", () => {
    expect(parseSalesProductDisplay(JSON.stringify({ mode: "list" }))).toEqual({ mode: "list" });
    expect(parseSalesProductDisplay(JSON.stringify({ mode: "cards", columns: 3 }))).toEqual({
      mode: "cards",
      columns: 3,
    });
    expect(parseSalesProductDisplay(JSON.stringify({ mode: "list", columns: 4 }))).toEqual({
      mode: "list",
    });
    expect(parseSalesProductDisplay(JSON.stringify({ mode: "grid", columns: 9 }))).toEqual({
      mode: "grid",
    });
  });

  it("serializes without invalid columns", () => {
    expect(serializeSalesProductDisplay({ mode: "icons", columns: 4 })).toBe(
      JSON.stringify({ mode: "icons", columns: 4 }),
    );
    expect(serializeSalesProductDisplay({ mode: "list", columns: 3 })).toBe(
      JSON.stringify({ mode: "list" }),
    );
  });

  it("round-trips valid preferences", () => {
    const prefs = { mode: "dense" as const, columns: 5 as const };
    expect(parseSalesProductDisplay(serializeSalesProductDisplay(prefs))).toEqual(prefs);
  });

  it("supports columns only on grid-like modes", () => {
    expect(productDisplaySupportsColumns("list")).toBe(false);
    expect(productDisplaySupportsColumns("grid")).toBe(true);
    expect(productDisplaySupportsColumns("dense")).toBe(true);
  });

  it("defaults dense columns to 5", () => {
    expect(resolveProductDisplayColumns({ mode: "dense" })).toBe(5);
    expect(resolveProductDisplayColumns({ mode: "grid" })).toBeUndefined();
    expect(resolveProductDisplayColumns({ mode: "grid", columns: 3 })).toBe(3);
  });

  it("maps container and tile classes per mode", () => {
    expect(productDisplayContainerClass({ mode: "list" })).toContain("flex");
    expect(productDisplayContainerClass({ mode: "grid" })).toContain("grid");
    expect(productDisplayTileClass({ mode: "list" })).toContain("flex");
    expect(productDisplayTileClass({ mode: "icons" })).toContain("flex-col");
  });

  it("builds minmax grid templates that prevent crushing", () => {
    expect(productDisplayGridTemplate({ mode: "list" })).toBeUndefined();
    expect(productDisplayGridTemplate({ mode: "grid" })).toBe(
      `repeat(auto-fill, minmax(${productDisplayMinTileRem("grid")}rem, 1fr))`,
    );
    expect(productDisplayGridTemplate({ mode: "dense" })).toContain("calc(100% / 5)");
    expect(productDisplayGridTemplate({ mode: "cards", columns: 3 })).toContain("calc(100% / 3)");
    expect(productDisplayGridTemplate({ mode: "icons", columns: 4 })).toContain("minmax(max(");
  });
});
