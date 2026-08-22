"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_NAV_ACCORDION_GROUP,
  isNavAccordionGroup,
  NAV_ACCORDION_GROUP_IDS,
  type NavAccordionGroupId,
  type NavGroupId,
} from "@/config/navigation";

const STORAGE_KEY = "novend.navActiveGroup";
const LEGACY_STORAGE_KEY = "novend.navGroupsExpanded";
const CHANGE_EVENT = "novend-nav-active-group";

let cachedRaw: string | null = null;
let cachedActive: NavAccordionGroupId = DEFAULT_NAV_ACCORDION_GROUP;

function parseActiveGroup(raw: string | null): NavAccordionGroupId {
  if (!raw) return DEFAULT_NAV_ACCORDION_GROUP;

  if (isNavAccordionGroup(raw as NavGroupId)) {
    return raw as NavAccordionGroupId;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string" && isNavAccordionGroup(parsed as NavGroupId)) {
      return parsed as NavAccordionGroupId;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "active" in parsed &&
      typeof (parsed as { active: unknown }).active === "string" &&
      isNavAccordionGroup((parsed as { active: NavGroupId }).active)
    ) {
      return (parsed as { active: NavAccordionGroupId }).active;
    }
    if (parsed && typeof parsed === "object") {
      const legacy = parsed as Partial<Record<NavGroupId, boolean>>;
      for (const id of NAV_ACCORDION_GROUP_IDS) {
        if (legacy[id]) return id;
      }
    }
  } catch {
    /* ignore malformed storage */
  }

  return DEFAULT_NAV_ACCORDION_GROUP;
}

function readLegacyActiveGroup(): NavAccordionGroupId | null {
  if (typeof window === "undefined") return null;
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return null;
    return parseActiveGroup(legacyRaw);
  } catch {
    return null;
  }
}

function readActiveGroup(): NavAccordionGroupId {
  if (typeof window === "undefined") return DEFAULT_NAV_ACCORDION_GROUP;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedActive;
  }

  if (!raw) {
    const legacy = readLegacyActiveGroup();
    if (legacy) {
      writeActiveGroup(legacy);
      return legacy;
    }
    cachedRaw = null;
    cachedActive = DEFAULT_NAV_ACCORDION_GROUP;
    return cachedActive;
  }

  if (raw === cachedRaw) {
    return cachedActive;
  }

  cachedRaw = raw;
  cachedActive = parseActiveGroup(raw);
  return cachedActive;
}

function writeActiveGroup(next: NavAccordionGroupId) {
  cachedActive = next;
  cachedRaw = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
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
  const activeGroup = useSyncExternalStore(
    subscribe,
    readActiveGroup,
    () => DEFAULT_NAV_ACCORDION_GROUP,
  );

  const toggleGroup = useCallback((id: NavGroupId) => {
    if (!isNavAccordionGroup(id)) return;
    if (readActiveGroup() === id) return;
    writeActiveGroup(id);
  }, []);

  const expandGroup = useCallback((id: NavGroupId) => {
    if (!isNavAccordionGroup(id)) return;
    if (readActiveGroup() === id) return;
    writeActiveGroup(id);
  }, []);

  const isExpanded = useCallback(
    (id: NavGroupId) => isNavAccordionGroup(id) && activeGroup === id,
    [activeGroup],
  );

  return { isExpanded, toggleGroup, expandGroup, activeGroup };
}
