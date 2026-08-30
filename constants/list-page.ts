/** Default catalog / history page size. Sales POS search is not paged. */
export const DEFAULT_LIST_PAGE_SIZE = 20;

export const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export type ListPageSize = (typeof LIST_PAGE_SIZE_OPTIONS)[number];

export function clampListPageSize(value: number): ListPageSize {
  if (value === 10 || value === 50) return value;
  return 20;
}

export function clampListPage(page: number, total: number, pageSize: number): number {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, page), pages);
}
