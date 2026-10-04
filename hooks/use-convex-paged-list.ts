"use client";

import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, usePaginatedQuery, type PaginatedQueryReference } from "convex/react";
import {
  clampListPageSize,
  DEFAULT_LIST_PAGE_SIZE,
  type ListPageSize,
} from "@/constants/list-page";
import { useLocalStorage } from "@/hooks/use-ui";

const PAGE_SIZE_KEY = "novend.listPageSize";

/**
 * Page-based navigation over a Convex cursor-paginated query.
 * Loads additional cursor pages only when the user moves forward.
 */
export function useConvexPagedList(
  query: PaginatedQueryReference,
  args: Record<string, unknown> | "skip",
  options?: { enabled?: boolean; resetKey?: string },
) {
  const { isAuthenticated } = useConvexAuth();
  // Paginated tenant queries throw Unauthenticated on an offline shell that regained the radio.
  const enabled = isAuthenticated && options?.enabled !== false && args !== "skip";
  const resetKey = options?.resetKey ?? "";
  const [storedPageSize, setStoredPageSize] = useLocalStorage<number>(
    PAGE_SIZE_KEY,
    DEFAULT_LIST_PAGE_SIZE,
  );
  const pageSize = clampListPageSize(storedPageSize);
  const [paging, setPaging] = useState({ resetKey, page: 1 });
  if (paging.resetKey !== resetKey) {
    setPaging({ resetKey, page: 1 });
  }
  const page = paging.resetKey === resetKey ? paging.page : 1;
  const setPage = (next: number) => setPaging((current) => ({ ...current, page: next }));

  const { results, status, loadMore } = usePaginatedQuery(query, enabled ? args : "skip", {
    initialNumItems: pageSize,
  });

  const neededCount = page * pageSize;
  useEffect(() => {
    if (!enabled) return;
    if (status === "LoadingFirstPage" || status === "LoadingMore") return;
    if (results.length >= neededCount) return;
    if (status !== "CanLoadMore") return;
    void loadMore(Math.max(pageSize, neededCount - results.length));
  }, [enabled, status, results.length, neededCount, loadMore, pageSize]);

  const items = useMemo(
    () => results.slice((page - 1) * pageSize, page * pageSize),
    [results, page, pageSize],
  );

  const hasNextPage =
    results.length > page * pageSize ||
    status === "CanLoadMore" ||
    (status === "LoadingMore" && results.length >= page * pageSize);

  const total = hasNextPage ? page * pageSize + 1 : (page - 1) * pageSize + items.length;

  return {
    items,
    page,
    setPage,
    pageSize,
    setPageSize: (size: ListPageSize) => {
      setStoredPageSize(size);
      setPage(1);
    },
    total,
    hasNextPage,
    isLoading: status === "LoadingFirstPage",
    isLoadingPage: status === "LoadingMore" && results.length < neededCount,
  };
}
