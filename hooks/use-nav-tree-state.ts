"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  defaultNavGroupExpanded,
  type NavGroupId,
} from "@/config/navigation";

const STORAGE_KEY = "novend.navGroupsExpanded";
const CHANGE_EVENT = "novend-nav-groups-expanded";
const DEFAULT_EXPANDED = defaultNavGroupExpanded();
const SERVER_SNAPSHOT = DEFAULT_EXPANDED;

let cachedRaw: string | null = null;
let cachedSnapshot: Record<NavGroupId, boolean> = DEFAULT_EXPANDED;

function normalizeExpanded(
  parsed?: Partial<Record<NavGroupId, boolean>>,
): Record<NavGroupId, boolean> {
  return { ...DEFAULT_EXPANDED, ...parsed };
}

function readExpanded(): Record<NavGroupId, boolean> {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedSnapshot;
  }

  if (raw === cachedRaw) {
    return cachedSnapshot;
  }

  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = DEFAULT_EXPANDED;
    return cachedSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Record<NavGroupId, boolean>>;
    cachedSnapshot = normalizeExpanded(parsed);
  } catch {
    cachedSnapshot = DEFAULT_EXPANDED;
  }
  return cachedSnapshot;
}

function writeExpanded(next: Record<NavGroupId, boolean>) {
  const normalized = normalizeExpanded(next);
  cachedSnapshot = normalized;
  cachedRaw = JSON.stringify(normalized);
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    /* ignore quota / privacy errors */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function useNavTreeState() {
  const expanded = useSyncExternalStore(subscribe, readExpanded, () => SERVER_SNAPSHOT);

  const toggleGroup = useCallback((id: NavGroupId) => {
    const current = readExpanded();
    writeExpanded({ ...current, [id]: !current[id] });
  }, []);

  const expandGroup = useCallback((id: NavGroupId) => {
    const current = readExpanded();
    if (current[id]) return;
    writeExpanded({ ...current, [id]: true });
  }, []);

  const isExpanded = useCallback((id: NavGroupId) => expanded[id], [expanded]);

  return { isExpanded, toggleGroup, expandGroup };
}
