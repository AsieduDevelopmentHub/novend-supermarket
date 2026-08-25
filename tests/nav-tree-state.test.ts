import { describe, expect, it } from "vitest";
import {
  DEFAULT_NAV_ACCORDION_GROUP,
  isNavAccordionGroup,
  NAV_ACCORDION_GROUP_IDS,
} from "@/config/navigation";

describe("nav accordion groups", () => {
  it("defaults to sales", () => {
    expect(DEFAULT_NAV_ACCORDION_GROUP).toBe("sales");
  });

  it("treats overview as fixed, not accordion", () => {
    expect(isNavAccordionGroup("overview")).toBe(false);
    expect(isNavAccordionGroup("sales")).toBe(true);
  });

  it("lists all collapsible workflow sections", () => {
    expect(NAV_ACCORDION_GROUP_IDS).toEqual(["sales", "inventory", "business", "administration"]);
  });
});
