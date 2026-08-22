import { describe, expect, it } from "vitest";
import {
  defaultNavGroupExpanded,
  findNavGroupForPath,
  flatNavForRole,
  navGroupsForRole,
  SETTINGS_ITEM,
} from "@/config/navigation";

describe("navigation tree", () => {
  it("groups items in business workflow order", () => {
    const groups = navGroupsForRole("administrator");
    expect(groups.map((g) => g.id)).toEqual([
      "overview",
      "sales",
      "inventory",
      "business",
      "administration",
    ]);
  });

  it("hides wholesale and analytics from cashiers", () => {
    const groups = navGroupsForRole("cashier");
    expect(groups.map((g) => g.id)).toEqual(["overview", "sales", "inventory", "business"]);
    expect(groups.find((g) => g.id === "inventory")?.items.map((i) => i.href)).toEqual([
      "/products",
      "/inventory",
    ]);
    expect(flatNavForRole("cashier").some((i) => i.href === "/wholesale")).toBe(false);
  });

  it("keeps settings separate from tree groups", () => {
    const flat = flatNavForRole("cashier");
    expect(flat.at(-1)).toEqual(SETTINGS_ITEM);
    expect(navGroupsForRole("cashier").flatMap((g) => g.items)).not.toContainEqual(SETTINGS_ITEM);
  });

  it("defaults to sales as the only expanded accordion group", () => {
    const defaults = defaultNavGroupExpanded();
    expect(defaults.overview).toBe(false);
    expect(defaults.sales).toBe(true);
    expect(defaults.inventory).toBe(false);
    expect(defaults.business).toBe(false);
    expect(defaults.administration).toBe(false);
  });

  it("resolves active group from path", () => {
    expect(findNavGroupForPath("/sales")).toBe("sales");
    expect(findNavGroupForPath("/orders/abc")).toBe("sales");
    expect(findNavGroupForPath("/products/abc")).toBe("inventory");
    expect(findNavGroupForPath("/settings")).toBe(null);
  });
});
