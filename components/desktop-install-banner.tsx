"use client";

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useQuery } from "convex/react";
import { Download, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/constants/app";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import { detectBrowserDesktopTarget, type BrowserDesktopTarget } from "@/lib/desktop";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "princellen.desktop.installBannerShows";
const MAX_SHOWS = 2;
const SHOW_DELAY_MS = 1800;

/** Cached once — UA does not change; stable reference required by useSyncExternalStore. */
let cachedBrowserTarget: BrowserDesktopTarget | null | undefined;

function subscribeNoop() {
  return () => {};
}

function getBrowserTargetSnapshot(): BrowserDesktopTarget | null {
  if (cachedBrowserTarget === undefined) {
    cachedBrowserTarget = detectBrowserDesktopTarget();
  }
  return cachedBrowserTarget;
}

function readShowCount() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const count = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return MAX_SHOWS;
  }
}

function writeShowCount(count: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(count));
  } catch {
    // ignore quota errors
  }
}

function formatBytes(size?: number) {
  if (size == null || size <= 0) return null;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

class BannerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[DesktopInstallBanner]", error.message, info.componentStack);
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function DesktopInstallBannerInner() {
  const isDesktop = useDesktopRuntime();
  const target = useSyncExternalStore(subscribeNoop, getBrowserTargetSnapshot, () => null);
  const [visible, setVisible] = useState(false);

  // Only hit Convex after the soft-show window — avoids noisy failures on every page load.
  const offer = useQuery(
    api.desktopReleases.getInstallOffer,
    !isDesktop && target && visible ? { preferredArch: target.arch, channel: "stable" } : "skip",
  );

  useEffect(() => {
    if (isDesktop || !target) return;
    if (typeof window === "undefined") return;
    if (readShowCount() >= MAX_SHOWS) return;

    const timer = window.setTimeout(() => {
      if (readShowCount() >= MAX_SHOWS) return;
      writeShowCount(readShowCount() + 1);
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isDesktop, target]);

  if (isDesktop || !visible || !target) return null;
  if (offer === undefined || offer === null) return null;

  const download = offer.downloads[target.platform];
  if (!download?.url) return null;

  const sizeLabel = formatBytes(download.size);
  const downloadUrl = download.url;

  function dismiss() {
    setVisible(false);
  }

  function install() {
    writeShowCount(MAX_SHOWS);
    setVisible(false);
    window.location.assign(downloadUrl);
  }

  return (
    <div
      role="region"
      aria-label={`Install ${APP_NAME} for ${target.label}`}
      className={cn(
        "border-border bg-card text-card-foreground fixed inset-x-0 bottom-0 z-50 border-t shadow-[0_-8px_24px_rgba(0,0,0,0.08)]",
        "px-4 py-3 sm:px-6",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3 sm:items-center">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md sm:mt-0">
          <Download className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium tracking-tight">
            Install {APP_NAME} for {target.label}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed sm:text-sm">
            Get the desktop app for offline reliability, receipt printing, and faster checkout
            {offer.version ? ` · v${offer.version}` : ""}
            {sizeLabel ? ` · ${sizeLabel}` : ""}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" onClick={install}>
            Download
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={dismiss}
            aria-label="Dismiss install banner"
          >
            <X className="size-4" />
            <span className="sr-only sm:not-sr-only sm:inline">Not now</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Soft nudge for browser users to install the Electron desktop app.
 * Download URLs come from Convex (`desktopReleases.getInstallOffer`).
 * Never shown inside the Electron shell. Failures are swallowed so the POS shell stays up.
 */
export function DesktopInstallBanner() {
  return (
    <BannerErrorBoundary>
      <DesktopInstallBannerInner />
    </BannerErrorBoundary>
  );
}
