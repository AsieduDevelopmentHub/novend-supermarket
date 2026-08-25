"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { persistLastRoute } from "@/lib/auth/last-route";
import { useForceClientShell } from "@/hooks/use-force-client-shell";
import { resolveOfflineView } from "@/providers/offline-views";

type OfflineNavigationContextValue = {
  /** True when the shell is rendering a client-side route instead of Next RSC children. */
  clientRouting: boolean;
  /** Path currently shown while client shell routing is active. */
  activePath: string | null;
  /**
   * Navigate within the authenticated shell.
   * Uses history + client feature views (online and offline) so tab switches
   * never wait on an RSC round-trip or flash `loading.tsx`.
   */
  navigate: (href: string) => void;
};

const OfflineNavigationContext = createContext<OfflineNavigationContextValue | null>(null);

function normalizePath(href: string): string {
  try {
    const url = new URL(href, "http://local.invalid");
    const path = url.pathname.replace(/\/$/, "") || "/";
    return path;
  } catch {
    return href.split("?")[0]?.replace(/\/$/, "") || "/";
  }
}

function pathWithSearch(href: string): string {
  try {
    const url = new URL(href, "http://local.invalid");
    const path = url.pathname.replace(/\/$/, "") || "/";
    return `${path}${url.search}`;
  } catch {
    return href;
  }
}

function isInternalAppHref(href: string | null): href is string {
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  if (/^https?:\/\//i.test(href)) return false;
  return href.startsWith("/");
}

function isAuthOrApiHref(href: string): boolean {
  return (
    href.startsWith("/login") ||
    href.startsWith("/signup") ||
    href.startsWith("/api/") ||
    href.startsWith("/onboarding")
  );
}

/** App shell scroll lives on <main>, not window — reset it when the route changes. */
function resetShellScroll() {
  if (typeof document === "undefined") return;
  const root = document.querySelector("[data-novend-scroll-root]");
  if (root instanceof HTMLElement) {
    root.scrollTop = 0;
  }
  window.scrollTo(0, 0);
}

/**
 * Keeps the authenticated shell mounted across in-app navigation.
 * Offline: avoids broken RSC fetches. Online: avoids network-bound soft nav
 * that made every tab feel like a full reload.
 */
export function OfflineNavigationProvider({ children }: { children: ReactNode }) {
  const online = useConnectivity();
  const forceClientShell = useForceClientShell();
  const pathname = usePathname();
  const router = useRouter();
  const [clientPath, setClientPath] = useState<string | null>(null);
  const lastScrollRoute = useRef<string | null>(null);

  const navigate = useCallback(
    (href: string) => {
      const path = normalizePath(href);
      const full = pathWithSearch(href);
      persistLastRoute(full);
      window.history.pushState({}, "", full);
      setClientPath(path);
      if (online && !forceClientShell) {
        try {
          void router.prefetch(href);
        } catch {
          /* ignore */
        }
      }
    },
    [online, forceClientShell, router],
  );

  const routeKey = clientPath ?? normalizePath(pathname);

  useEffect(() => {
    if (lastScrollRoute.current === null) {
      lastScrollRoute.current = routeKey;
      return;
    }
    if (lastScrollRoute.current === routeKey) return;
    lastScrollRoute.current = routeKey;
    // After the destination view paints into the shared shell scroller.
    queueMicrotask(() => resetShellScroll());
  }, [routeKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search || "";
    persistLastRoute(`${normalizePath(pathname)}${search}`);
  }, [pathname]);

  useEffect(() => {
    if (!forceClientShell) return;
    // Cap / offline / hung-online: enable client views for the current URL so
    // analytics, sales, reports, etc. never wait on a dead RSC fetch.
    queueMicrotask(() => {
      setClientPath(normalizePath(window.location.pathname));
    });
  }, [forceClientShell, pathname]);

  useEffect(() => {
    if (!online || !clientPath || forceClientShell) return;
    try {
      void router.prefetch(clientPath);
    } catch {
      /* ignore */
    }
  }, [online, clientPath, forceClientShell, router]);

  useEffect(() => {
    const onPopState = () => {
      setClientPath(normalizePath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Capture in-app link clicks so Next Link never blocks on RSC (online or offline).
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!isInternalAppHref(href)) return;
      if (isAuthOrApiHref(href)) return;

      event.preventDefault();
      event.stopPropagation();
      navigate(href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate]);

  const activePath = clientPath ?? (forceClientShell ? normalizePath(pathname) : null);
  const shouldRenderClientView = Boolean(clientPath) || forceClientShell;

  const value = useMemo<OfflineNavigationContextValue>(
    () => ({
      clientRouting: shouldRenderClientView,
      activePath: shouldRenderClientView ? activePath : null,
      navigate,
    }),
    [shouldRenderClientView, activePath, navigate],
  );

  return (
    <OfflineNavigationContext.Provider value={value}>{children}</OfflineNavigationContext.Provider>
  );
}

/** Renders the client feature view inside the shell main area (keeps sidebar mounted). */
export function OfflineOutlet({ children }: { children: ReactNode }) {
  const { clientRouting, activePath } = useOfflineNavigation();
  if (clientRouting && activePath) {
    return <>{resolveOfflineView(activePath)}</>;
  }
  return <>{children}</>;
}

export function useOfflineNavigation() {
  const ctx = useContext(OfflineNavigationContext);
  if (!ctx) {
    return {
      clientRouting: false,
      activePath: null,
      navigate: (href: string) => {
        if (typeof window !== "undefined") window.location.assign(href);
      },
    } satisfies OfflineNavigationContextValue;
  }
  return ctx;
}
