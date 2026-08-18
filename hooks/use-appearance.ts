"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTheme } from "next-themes";

export type FontSize = "sm" | "md" | "lg";
export type AppearanceTheme = "light" | "dark" | "system";

/** Stable device cache key — do not remount ThemeProvider per user (that resets prefs). */
export const THEME_STORAGE_KEY = "novend-theme";
const FONT_STORAGE_KEY = "novend-font-size";

const listeners = new Set<() => void>();

function isFontSize(value: string | null): value is FontSize {
  return value === "sm" || value === "md" || value === "lg";
}

function isTheme(value: string | null): value is AppearanceTheme {
  return value === "light" || value === "dark" || value === "system";
}

export function getStoredFontSize(): FontSize {
  if (typeof window === "undefined") return "md";
  const value = window.localStorage.getItem(FONT_STORAGE_KEY);
  if (isFontSize(value)) return value;
  return "md";
}

export function getStoredTheme(): AppearanceTheme | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isTheme(value)) return value;
  return null;
}

export function subscribeFontSize(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fontSize = size;
  window.localStorage.setItem(FONT_STORAGE_KEY, size);
  listeners.forEach((listener) => listener());
}

/** Apply font size from localStorage as early as possible (before auth resolves). */
export function AppearanceBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyFontSize(getStoredFontSize());
  }, []);
  return children;
}

/**
 * After login, restore theme/font from the user profile (source of truth),
 * migrating any device-local prefs into the profile when missing.
 */
export function AppearanceProfileSync() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const updateOwnAppearance = useMutation(api.users.updateOwnAppearance);
  const { setTheme } = useTheme();
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!me || me.needsProfile || !me.userId) return;
    if (syncedForUser.current === me.userId) return;
    syncedForUser.current = me.userId;

    const localTheme = getStoredTheme();
    const localFont = getStoredFontSize();
    const theme: AppearanceTheme = me.appearanceTheme ?? localTheme ?? "system";
    const fontSize: FontSize = me.appearanceFontSize ?? localFont;

    setTheme(theme);
    applyFontSize(fontSize);

    if (!me.appearanceTheme || !me.appearanceFontSize) {
      void updateOwnAppearance({ theme, fontSize });
    }
  }, [me, setTheme, updateOwnAppearance]);

  return null;
}

export function useAppearance() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const fontSize = useSyncExternalStore(
    subscribeFontSize,
    getStoredFontSize,
    () => "md" as FontSize,
  );

  return {
    theme: theme ?? "system",
    setTheme,
    resolvedTheme,
    fontSize,
    setFontSize: applyFontSize,
  };
}
