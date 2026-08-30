import { describe, expect, it } from "vitest";
import { clampListPage, clampListPageSize } from "@/constants/list-page";
import { pageSlice } from "@/lib/offline/page-slice";

describe("list page helpers", () => {
  it("clamps page size to 10, 20, or 50", () => {
    expect(clampListPageSize(10)).toBe(10);
    expect(clampListPageSize(20)).toBe(20);
    expect(clampListPageSize(50)).toBe(50);
    expect(clampListPageSize(7)).toBe(20);
  });

  it("slices a filtered list without dropping the total", () => {
    const rows = Array.from({ length: 45 }, (_, i) => i + 1);
    const page = pageSlice(rows, 2, 20);
    expect(page.total).toBe(45);
    expect(page.items).toEqual(rows.slice(20, 40));
    expect(page.page).toBe(2);
  });

  it("clamps past the last page", () => {
    expect(clampListPage(9, 45, 20)).toBe(3);
    expect(pageSlice([1, 2, 3], 8, 20).items).toEqual([1, 2, 3]);
  });
});
