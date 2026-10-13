import { describe, expect, it } from "vitest";
import {
  assertValidPriceRule,
  resolveUnitPrice,
  type PriceListRuleLike,
  type PricingContext,
} from "@/convex/shared/pricing";

const context = (overrides: Partial<PricingContext> = {}): PricingContext => ({
  productId: "p1",
  categoryId: "cat1",
  customerGroupId: null,
  baseQuantity: 1,
  factorToBase: 1,
  pricingMode: "fixed",
  sellUnitPrice: 10,
  productSellingPrice: 10,
  ...overrides,
});

const rule = (overrides: Partial<PriceListRuleLike>): PriceListRuleLike => ({
  id: "r",
  productId: "p1",
  categoryId: null,
  groupId: null,
  minBaseQty: 1,
  unitPrice: 8,
  priority: 0,
  active: true,
  ...overrides,
});

describe("resolveUnitPrice", () => {
  it("falls back to the sell unit price, then the catalogue price", () => {
    expect(resolveUnitPrice([], context()).source).toBe("sell_unit");
    expect(resolveUnitPrice([], context({ sellUnitPrice: null })).unitPrice).toBe(10);
    expect(resolveUnitPrice([], context({ sellUnitPrice: null, factorToBase: 12 }))).toEqual({
      unitPrice: 120,
      source: "product",
    });
  });

  it("applies a volume tier once the base quantity is reached", () => {
    const rules = [rule({ id: "tier", minBaseQty: 24, unitPrice: 7 })];
    expect(resolveUnitPrice(rules, context({ baseQuantity: 23 })).source).toBe("sell_unit");
    expect(resolveUnitPrice(rules, context({ baseQuantity: 24 }))).toMatchObject({
      unitPrice: 7,
      source: "rule",
      ruleId: "tier",
    });
  });

  it("multiplies the per-base rule price by the sell unit factor", () => {
    const rules = [rule({ unitPrice: 7 })];
    expect(resolveUnitPrice(rules, context({ factorToBase: 12, baseQuantity: 12 })).unitPrice).toBe(
      84,
    );
  });

  it("only applies a group rule to that group's customers", () => {
    const rules = [rule({ id: "g", groupId: "wholesale", unitPrice: 6 })];
    expect(resolveUnitPrice(rules, context({ customerGroupId: null })).source).toBe("sell_unit");
    expect(resolveUnitPrice(rules, context({ customerGroupId: "retail" })).source).toBe(
      "sell_unit",
    );
    expect(resolveUnitPrice(rules, context({ customerGroupId: "wholesale" })).unitPrice).toBe(6);
  });

  it("prefers priority, then product over category, then group over generic, then bigger tier", () => {
    const category = rule({ id: "cat", productId: null, categoryId: "cat1", unitPrice: 5 });
    const product = rule({ id: "prod", unitPrice: 9 });
    expect(resolveUnitPrice([category, product], context()).ruleId).toBe("prod");

    const highPriority = rule({ id: "hp", productId: null, categoryId: "cat1", priority: 5 });
    expect(resolveUnitPrice([product, highPriority], context()).ruleId).toBe("hp");

    const generic = rule({ id: "generic", unitPrice: 9 });
    const grouped = rule({ id: "grouped", groupId: "wholesale", unitPrice: 8 });
    expect(
      resolveUnitPrice([generic, grouped], context({ customerGroupId: "wholesale" })).ruleId,
    ).toBe("grouped");

    const small = rule({ id: "small", minBaseQty: 1, unitPrice: 9 });
    const big = rule({ id: "big", minBaseQty: 10, unitPrice: 7 });
    expect(resolveUnitPrice([small, big], context({ baseQuantity: 10 })).ruleId).toBe("big");
  });

  it("ignores inactive rules and never reprices weight-priced lines", () => {
    expect(resolveUnitPrice([rule({ active: false })], context()).source).toBe("sell_unit");
    expect(
      resolveUnitPrice([rule({})], context({ pricingMode: "per_weight", sellUnitPrice: 25 })),
    ).toEqual({ unitPrice: 25, source: "sell_unit" });
  });
});

describe("assertValidPriceRule", () => {
  it("needs a target and sane numbers", () => {
    expect(() =>
      assertValidPriceRule({ productId: "p", minBaseQty: 1, unitPrice: 5, priority: 0 }),
    ).not.toThrow();
    expect(() => assertValidPriceRule({ minBaseQty: 1, unitPrice: 5, priority: 0 })).toThrow(
      /product or a category/i,
    );
    expect(() =>
      assertValidPriceRule({ productId: "p", minBaseQty: 0, unitPrice: 5, priority: 0 }),
    ).toThrow(/minimum quantity/i);
    expect(() =>
      assertValidPriceRule({ productId: "p", minBaseQty: 1, unitPrice: -1, priority: 0 }),
    ).toThrow(/valid price/i);
    expect(() =>
      assertValidPriceRule({ productId: "p", minBaseQty: 1, unitPrice: 5, priority: -1 }),
    ).toThrow(/priority/i);
  });
});
