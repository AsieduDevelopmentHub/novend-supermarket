"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_PLATFORM_NAV_ACCORDION_GROUP,
  isPlatformNavAccordionGroup,
  type PlatformNavAccordionGroupId,
  type PlatformNavGroupId,
} from "@/config/platform-navigation";

const STORAGE_KEY = "novend.platformNavActiveGroup";
const CHANGE_EVENT = "novend-platform-nav-active-group";

let cachedRaw: string | null = null;
let cachedActive: PlatformNavAccordionGroupId = DEFAULT_PLATFORM_NAV_ACCORDION_GROUP;

function parseActiveGroup(raw: string | null): PlatformNavAccordionGroupId {
  if (raw && isPlatformNavAccordionGroup(raw as PlatformNavGroupId)) {
    return raw as PlatformNavAccordionGroupId;
  }
  return DEFAULT_PLATFORM_NAV_ACCORDION_GROUP;
}

function readActiveGroup(): PlatformNavAccordionGroupId {
  if (typeof window === "undefined") return DEFAULT_PLATFORM_NAV_ACCORDION_GROUP;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedActive;
  }

  if (!raw) {
    cachedRaw = null;
    cachedActive = DEFAULT_PLATFORM_NAV_ACCORDION_GROUP;
    return cachedActive;
  }

  if (raw === cachedRaw) return cachedActive;

  cachedRaw = raw;
  cachedActive = parseActiveGroup(raw);
  return cachedActive;
}

function writeActiveGroup(next: PlatformNavAccordionGroupId) {
  cachedActive = next;
  cachedRaw = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
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

export function usePlatformNavTreeState() {
  const activeGroup = useSyncExternalStore(
    subscribe,
    readActiveGroup,
    () => DEFAULT_PLATFORM_NAV_ACCORDION_GROUP,
  );

  const toggleGroup = useCallback((id: PlatformNavGroupId) => {
    if (!isPlatformNavAccordionGroup(id)) return;
    if (readActiveGroup() === id) return;
    writeActiveGroup(id);
  }, []);

  const expandGroup = useCallback((id: PlatformNavGroupId) => {
    if (!isPlatformNavAccordionGroup(id)) return;
    if (readActiveGroup() === id) return;
    writeActiveGroup(id);
  }, []);

  const isExpanded = useCallback(
    (id: PlatformNavGroupId) => isPlatformNavAccordionGroup(id) && activeGroup === id,
    [activeGroup],
  );

  return { isExpanded, toggleGroup, expandGroup, activeGroup };
}
