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
import { Apple, Download, MonitorSmartphone, Share, Smartphone } from "lucide-react";
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
import { useNativeShell } from "@/hooks/use-native-shell";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  detectBrowserDesktopTarget,
  type BrowserDesktopTarget,
} from "@/lib/desktop";
import {
  isIosSafari,
  isStandaloneWebApp,
  resolveInstallPromptKind,
  resolveMobileInstallOs,
  type InstallPromptKind,
  type MobileInstallOs,
} from "@/lib/device-install";

const MAX_SHOWS = 2;
const SHOW_DELAY_MS = 1800;

type PromptSurface =
  | "desktop-native"
  | "android-native"
  | "ios-native"
  | "mobile-pwa";

let cachedBrowserTarget: BrowserDesktopTarget | null | undefined;
let cachedPromptKind: InstallPromptKind | null | undefined;
let cachedMobileOs: MobileInstallOs | null | undefined;

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

function getMobileOsSnapshot(): MobileInstallOs | null {
  if (cachedMobileOs === undefined) {
    cachedMobileOs = resolveMobileInstallOs();
  }
  return cachedMobileOs;
}

function storageKey(surface: PromptSurface) {
  return `novend.install.promptShows.${surface}`;
}

function readShowCount(surface: PromptSurface) {
  try {
    const raw = window.localStorage.getItem(storageKey(surface));
    const count = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return MAX_SHOWS;
  }
}

function writeShowCount(surface: PromptSurface, count: number) {
  try {
    window.localStorage.setItem(storageKey(surface), String(count));
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
  const nativeShell = useNativeShell();
  const promptKind = useSyncExternalStore(subscribeNoop, getPromptKindSnapshot, () => null);
  const desktopTarget = useSyncExternalStore(subscribeNoop, getBrowserTargetSnapshot, () => null);
  const mobileOs = useSyncExternalStore(subscribeNoop, getMobileOsSnapshot, () => null);
  const { canPrompt, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [activeSurface, setActiveSurface] = useState<PromptSurface | null>(null);

  const desktopOffer = useQuery(
    api.desktopReleases.getInstallOffer,
    !isDesktopShell && promptKind === "desktop" && desktopTarget
      ? { preferredArch: desktopTarget.arch, channel: "stable" }
      : "skip",
  );

  const mobileOffer = useQuery(
    api.mobileReleases.getInstallOffer,
    !isDesktopShell && promptKind === "mobile" ? { channel: "stable" } : "skip",
  );

  const desktopNativeUrl =
    desktopTarget && desktopOffer ? desktopOffer.downloads[desktopTarget.platform]?.url : undefined;
  const androidNative =
    mobileOffer?.downloads.android?.url || mobileOffer?.storeUrls.android || undefined;
  const iosNative =
    mobileOffer?.downloads.ios?.url || mobileOffer?.storeUrls.ios || undefined;

  const surface: PromptSurface | null = (() => {
    if (isDesktopShell || nativeShell || isStandaloneWebApp() || !promptKind) return null;
    if (promptKind === "desktop") {
      if (!desktopTarget) return null;
      if (desktopOffer === undefined) return null;
      if (!desktopNativeUrl) return null;
      return "desktop-native";
    }
    // Mobile / iOS: native download when a published release exists for this OS.
    if (mobileOffer === undefined) return null;
    if (mobileOs === "android" && androidNative) return "android-native";
    if (mobileOs === "ios" && iosNative) return "ios-native";
    // PWA / Add to Home Screen only when there is no native release for this device.
    return "mobile-pwa";
  })();

  useEffect(() => {
    if (!surface) return;
    if (readShowCount(surface) >= MAX_SHOWS) return;

    const timer = window.setTimeout(() => {
      if (readShowCount(surface) >= MAX_SHOWS) return;
      writeShowCount(surface, readShowCount(surface) + 1);
      setActiveSurface(surface);
      setOpen(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [surface]);

  if (isDesktopShell || nativeShell || !promptKind || !surface || !activeSurface) return null;

  function dismiss() {
    setOpen(false);
  }

  function dismissForever() {
    if (activeSurface) writeShowCount(activeSurface, MAX_SHOWS);
    setOpen(false);
  }

  async function installPwa() {
    dismissForever();
    if (canPrompt) {
      await promptInstall();
    }
  }

  function openDownload(url: string) {
    dismissForever();
    window.location.assign(url);
  }

  if (activeSurface === "mobile-pwa") {
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
              <li>
                Select <span className="text-foreground font-medium">Add to Home Screen</span>
              </li>
              <li>Tap Add — Novend opens like an app from your home screen</li>
            </ol>
          ) : canPrompt ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Install Novend as an app shortcut on this phone or tablet for faster launches and a
              cleaner full-screen experience.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Open your browser menu and choose{" "}
              <span className="text-foreground font-medium">Install app</span> or{" "}
              <span className="text-foreground font-medium">Add to Home screen</span>.
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
            {canPrompt ? (
              <Button type="button" onClick={() => void installPwa()}>
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

  if (activeSurface === "android-native" && androidNative) {
    const sizeLabel = formatBytes(mobileOffer?.downloads.android?.size);
    const isStore = Boolean(mobileOffer?.storeUrls.android && !mobileOffer?.downloads.android?.url);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-xl">
              <Smartphone className="size-6" aria-hidden />
            </div>
            <DialogTitle>Download {APP_NAME} for Android</DialogTitle>
            <DialogDescription>
              Install the native Android app for a faster, more reliable counter experience
              {mobileOffer?.version ? ` · v${mobileOffer.version}` : ""}
              {sizeLabel ? ` · ${sizeLabel}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
            <Button type="button" onClick={() => openDownload(androidNative)}>
              <Download className="mr-2 size-4" aria-hidden />
              {isStore ? "Open Play Store" : "Download Android app"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (activeSurface === "ios-native" && iosNative) {
    const isStore = Boolean(mobileOffer?.storeUrls.ios && !mobileOffer?.downloads.ios?.url);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-xl">
              <Apple className="size-6" aria-hidden />
            </div>
            <DialogTitle>Download {APP_NAME} for iPhone &amp; iPad</DialogTitle>
            <DialogDescription>
              Get the native iOS app for the best experience on this device
              {mobileOffer?.version ? ` · v${mobileOffer.version}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
            <Button type="button" onClick={() => openDownload(iosNative)}>
              <Download className="mr-2 size-4" aria-hidden />
              {isStore ? "Open App Store" : "Download iOS app"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (activeSurface === "desktop-native" && desktopTarget && desktopNativeUrl) {
    const download = desktopOffer?.downloads[desktopTarget.platform];
    const sizeLabel = formatBytes(download?.size);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-xl">
              <Download className="size-6" aria-hidden />
            </div>
            <DialogTitle>
              Download {APP_NAME} for {desktopTarget.label}
            </DialogTitle>
            <DialogDescription>
              Get the desktop app for offline reliability, receipt printing, and faster checkout
              {desktopOffer?.version ? ` · v${desktopOffer.version}` : ""}
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
            <Button type="button" onClick={() => openDownload(desktopNativeUrl)}>
              <Download className="mr-2 size-4" aria-hidden />
              Download for {desktopTarget.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

/** Browser install nudge: native download when a release exists; PWA only on mobile without one. */
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
