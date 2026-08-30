"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clampListPageSize, DEFAULT_LIST_PAGE_SIZE, type ListPageSize } from "@/constants/list-page";
import { pageSlice } from "@/lib/offline/page-slice";

export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota errors
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function usePagination(initialPage = 1, pageSize = DEFAULT_LIST_PAGE_SIZE) {
  const [page, setPage] = useState(initialPage);
  const [size, setSize] = useState(pageSize);
  const reset = useCallback(() => setPage(1), []);
  return { page, setPage, pageSize: size, setPageSize: setSize, reset };
}

const PAGE_SIZE_KEY = "novend.listPageSize";

/** Persist page size and slice an already-filtered client list. */
export function useClientPagedRows<T>(rows: T[] | undefined, resetKey: string) {
  const [stored, setStored] = useLocalStorage<number>(PAGE_SIZE_KEY, DEFAULT_LIST_PAGE_SIZE);
  const pageSize = clampListPageSize(stored);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = rows?.length ?? 0;
  const paged = useMemo(
    () => (rows ? pageSlice(rows, page, pageSize).items : undefined),
    [rows, page, pageSize],
  );

  return {
    page,
    setPage,
    pageSize,
    setPageSize: (size: ListPageSize) => {
      setStored(size);
      setPage(1);
    },
    total,
    paged,
  };
}
