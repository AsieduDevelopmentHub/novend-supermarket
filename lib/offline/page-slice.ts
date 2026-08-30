import { clampListPage } from "@/constants/list-page";

export type PagedRows<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/** Slice an already-filtered, already-sorted list. */
export function pageSlice<T>(rows: T[], page: number, pageSize: number): PagedRows<T> {
  const total = rows.length;
  const safePage = clampListPage(page, total, pageSize);
  const start = (safePage - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
  };
}
