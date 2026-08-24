"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { persistLastRoute } from "@/lib/auth/last-route";
import { resolveOfflineView } from "@/providers/offline-views";

type OfflineNavigationContextValue = {
  /** True when the shell is rendering a client-side route instead of Next RSC children. */
  clientRouting: boolean;
  /** Path currently shown while offline client routing is active. */
  activePath: string | null;
  /**
   * Navigate within the app. Online → Next soft navigation.
   * Offline → client view swap (no RSC fetch) so the shell never blanks.
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

/**
 * Keeps the authenticated shell mounted while offline by swapping feature views
 * client-side instead of relying on Next.js RSC soft navigations (which need the network).
 */
export function OfflineNavigationProvider({ children }: { children: ReactNode }) {
  const online = useConnectivity();
  const pathname = usePathname();
  const router = useRouter();
  const [clientPath, setClientPath] = useState<string | null>(null);

  const navigate = useCallback(
    (href: string) => {
      const path = normalizePath(href);
      persistLastRoute(pathWithSearch(href));
      if (online) {
        setClientPath(null);
        router.push(href);
        return;
      }
      window.history.pushState({}, "", href);
      setClientPath(path);
    },
    [online, router],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search || "";
    persistLastRoute(`${normalizePath(pathname)}${search}`);
  }, [pathname]);

  useEffect(() => {
    if (online) return;
    // Hard refresh / first paint offline: enable client views for the current URL
    // so we never depend on a cached RSC tree that cannot revalidate.
    queueMicrotask(() => {
      setClientPath(normalizePath(window.location.pathname));
    });
  }, [online]);

  useEffect(() => {
    if (!online || !clientPath) return;
    // Soft-nav catch-up after reconnect. Keep clientPath until Next owns the route;
    // clientRouting is already false while online.
    router.replace(clientPath);
  }, [online, clientPath, router]);

  useEffect(() => {
    const onPopState = () => {
      if (navigator.onLine) {
        setClientPath(null);
        return;
      }
      setClientPath(normalizePath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Capture in-app link clicks while offline so Next Link never triggers a failing RSC fetch.
  useEffect(() => {
    if (online) return;

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
      if (href.startsWith("/login") || href.startsWith("/api/")) return;

      event.preventDefault();
      event.stopPropagation();
      navigate(href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [online, navigate]);

  const activePath = !online ? (clientPath ?? normalizePath(pathname)) : null;
  // Always client-render feature views while offline (including after a full refresh).
  const shouldRenderClientView = Boolean(!online && activePath);

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

/** Renders the offline client view inside the shell main area (keeps sidebar mounted). */
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
