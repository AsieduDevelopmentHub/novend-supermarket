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
import { Download, MonitorSmartphone, Share, Smartphone } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APP_NAME } from "@/constants/app";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  detectBrowserDesktopTarget,
  type BrowserDesktopTarget,
} from "@/lib/desktop";
import {
  isIosSafari,
  isStandaloneWebApp,
  resolveInstallPromptKind,
  type InstallPromptKind,
} from "@/lib/device-install";

const DESKTOP_STORAGE_KEY = "novend.install.desktopPromptShows";
const MOBILE_STORAGE_KEY = "novend.install.mobilePromptShows";
const MAX_SHOWS = 2;
const SHOW_DELAY_MS = 1800;

let cachedBrowserTarget: BrowserDesktopTarget | null | undefined;
let cachedPromptKind: InstallPromptKind | null | undefined;

function subscribeNoop() {
  return () => {};
}

function getBrowserTargetSnapshot(): BrowserDesktopTarget | null {
  if (cachedBrowserTarget === undefined) {
    cachedBrowserTarget = detectBrowserDesktopTarget();
  }
  return cachedBrowserTarget;
}

function getPromptKindSnapshot(): InstallPromptKind | null {
  if (cachedPromptKind === undefined) {
    cachedPromptKind = resolveInstallPromptKind();
  }
  return cachedPromptKind;
}

function readShowCount(kind: InstallPromptKind) {
  const key = kind === "desktop" ? DESKTOP_STORAGE_KEY : MOBILE_STORAGE_KEY;
  try {
    const raw = window.localStorage.getItem(key);
    const count = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return MAX_SHOWS;
  }
}

function writeShowCount(kind: InstallPromptKind, count: number) {
  const key = kind === "desktop" ? DESKTOP_STORAGE_KEY : MOBILE_STORAGE_KEY;
  try {
    window.localStorage.setItem(key, String(count));
  } catch {
    // ignore quota errors
  }
}

function formatBytes(size?: number) {
  if (size == null || size <= 0) return null;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

class InstallPromptErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[InstallPromptDialog]", error.message, info.componentStack);
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function InstallPromptDialogInner() {
  const isDesktopShell = useDesktopRuntime();
  const promptKind = useSyncExternalStore(subscribeNoop, getPromptKindSnapshot, () => null);
  const desktopTarget = useSyncExternalStore(subscribeNoop, getBrowserTargetSnapshot, () => null);
  const { canPrompt, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);

  const offer = useQuery(
    api.desktopReleases.getInstallOffer,
    !isDesktopShell && promptKind === "desktop" && open && desktopTarget
      ? { preferredArch: desktopTarget.arch, channel: "stable" }
      : "skip",
  );

  useEffect(() => {
    if (isDesktopShell || isStandaloneWebApp() || !promptKind) return;
    if (promptKind === "desktop" && !desktopTarget) return;
    if (readShowCount(promptKind) >= MAX_SHOWS) return;

    const timer = window.setTimeout(() => {
      if (readShowCount(promptKind) >= MAX_SHOWS) return;
      writeShowCount(promptKind, readShowCount(promptKind) + 1);
      setOpen(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isDesktopShell, promptKind, desktopTarget]);

  if (isDesktopShell || !promptKind) return null;

  function dismiss() {
    setOpen(false);
  }

  function dismissForever() {
    if (promptKind) writeShowCount(promptKind, MAX_SHOWS);
    setOpen(false);
  }

  async function installMobile() {
    dismissForever();
    if (canPrompt) {
      await promptInstall();
      return;
    }
    // iOS / browsers without beforeinstallprompt — dialog already shows steps.
  }

  function installDesktop() {
    if (!desktopTarget || !offer) return;
    const download = offer.downloads[desktopTarget.platform];
    if (!download?.url) return;
    dismissForever();
    window.location.assign(download.url);
  }

  if (promptKind === "mobile") {
    const ios = isIosSafari();
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-xl">
              <Smartphone className="size-6" aria-hidden />
            </div>
            <DialogTitle>Install {APP_NAME} on your device</DialogTitle>
            <DialogDescription>
              Add Novend to your home screen for quick access, full-screen checkout, and offline
              reliability on this device.
            </DialogDescription>
          </DialogHeader>
          {ios ? (
            <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                Tap <Share className="text-foreground inline size-4 align-text-bottom" aria-hidden />{" "}
                Share in Safari
              </li>
              <li>Select <span className="text-foreground font-medium">Add to Home Screen</span></li>
              <li>Tap Add — Novend opens like an app from your home screen</li>
            </ol>
          ) : canPrompt ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Install Novend as an app shortcut on this phone or tablet for faster launches and a
              cleaner full-screen experience.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Open your browser menu and choose <span className="text-foreground font-medium">Install app</span>{" "}
              or <span className="text-foreground font-medium">Add to Home screen</span>.
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
            {canPrompt ? (
              <Button type="button" onClick={() => void installMobile()}>
                <MonitorSmartphone className="mr-2 size-4" aria-hidden />
                Install app
              </Button>
            ) : (
              <Button type="button" onClick={dismissForever}>
                Got it
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!desktopTarget) return null;
  if (open && offer === undefined) return null;
  if (offer === null) return null;

  const download = offer?.downloads[desktopTarget.platform];
  if (open && !download?.url) return null;

  const sizeLabel = formatBytes(download?.size);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-xl">
            <Download className="size-6" aria-hidden />
          </div>
          <DialogTitle>Install {APP_NAME} on {desktopTarget.label}</DialogTitle>
          <DialogDescription>
            Get the desktop app for offline reliability, receipt printing, and faster checkout
            {offer?.version ? ` · v${offer.version}` : ""}
            {sizeLabel ? ` · ${sizeLabel}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-muted-foreground space-y-1.5 text-sm leading-relaxed">
          <li>Runs from local data when the internet drops</li>
          <li>Silent receipt printing on connected hardware</li>
          <li>Automatic background sync when you&apos;re back online</li>
        </ul>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          <Button type="button" onClick={installDesktop} disabled={!download?.url}>
            <Download className="mr-2 size-4" aria-hidden />
            Download for {desktopTarget.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Browser-only install nudge: Electron on desktop OS, PWA / home screen on mobile. */
export function InstallPromptDialog() {
  return (
    <InstallPromptErrorBoundary>
      <InstallPromptDialogInner />
    </InstallPromptErrorBoundary>
  );
}

/** @deprecated Use InstallPromptDialog */
export function DesktopInstallBanner() {
  return <InstallPromptDialog />;
}
