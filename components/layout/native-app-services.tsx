"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Hardware,
  isCapacitor,
  withTimeout,
  NATIVE_AVAILABILITY_TIMEOUT_MS,
} from "@novend/hardware";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { sanitizeReleaseNoteLines } from "@/lib/sanitize-release-notes";
import { parseMobileDeepLink } from "@/lib/auth/mobile-deep-link";

type Gate = "checking" | "locked" | "open";

/** Second Android back within this window closes the app. */
const EXIT_DOUBLE_BACK_MS = 2200;

/**
 * Capacitor-only: biometric launch gate + deep link routing + soft update check + back button.
 * All native access goes through `@novend/hardware` (no Capacitor imports here).
 */
export function NativeAppServices({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("open");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateHighlights, setUpdateHighlights] = useState<string[]>([]);
  const [updateVersion, setUpdateVersion] = useState("");
  const [updateMandatory, setUpdateMandatory] = useState(false);
  const [installedVersion, setInstalledVersion] = useState("");
  const rootBackArmedUntil = useRef(0);

  useEffect(() => {
    if (!isCapacitor()) return;
    let cancelled = false;
    let removeUrlListener: (() => Promise<void>) | null = null;
    let removeBackListener: (() => Promise<void>) | null = null;
    let listenersDisposed = false;
    // Fail-open only while resolving prefs/token — clear before authenticate so a
    // short timer cannot unlock during the system biometric prompt.
    const failOpen = window.setTimeout(() => {
      if (!cancelled) setGate((current) => (current === "checking" ? "open" : current));
    }, NATIVE_AVAILABILITY_TIMEOUT_MS);

    void (async () => {
      try {
        const prefs = await withTimeout(
          Hardware.biometrics.getPrefs(),
          NATIVE_AVAILABILITY_TIMEOUT_MS,
        );
        if (!prefs.enabled || !prefs.requireOnLaunch) {
          if (!cancelled) setGate("open");
          return;
        }
        const token = await withTimeout(
          Hardware.biometrics.readUnlockToken(),
          NATIVE_AVAILABILITY_TIMEOUT_MS,
        );
        if (!token.data) {
          if (!cancelled) setGate("open");
          return;
        }
        if (!cancelled) setGate("checking");
        window.clearTimeout(failOpen);
        const auth = await withTimeout(
          Hardware.biometrics.authenticate("Unlock Novend POS"),
          30_000,
        );
        if (!cancelled) setGate(auth.ok ? "open" : "locked");
      } catch {
        if (!cancelled) setGate("open");
      } finally {
        window.clearTimeout(failOpen);
      }
    })();

    void (async () => {
      const launch = await Hardware.app.getLaunchUrl();
      if (launch.data) {
        const href = parseMobileDeepLink(launch.data, window.location.origin);
        if (href) router.replace(href);
      }
      const update = await Hardware.app.checkForUpdate();
      const appInfo = await Hardware.app.getInfo();
      if (appInfo.data) {
        setInstalledVersion(appInfo.data.version);
      }
      if (update.data?.available && update.data.status === "available") {
        setUpdateVersion(update.data.version || "");
        setUpdateHighlights(sanitizeReleaseNoteLines(update.data.notes));
        setUpdateMandatory(update.data.mandatory === true);
        setUpdateOpen(true);
      }
    })();

    void Hardware.app
      .addUrlOpenListener((url) => {
        const href = parseMobileDeepLink(url, window.location.origin);
        if (href) router.replace(href);
      })
      .then((handle) => {
        if (listenersDisposed) void handle.remove();
        else removeUrlListener = handle.remove;
      });

    void Hardware.app
      .addBackButtonListener(({ canGoBack }) => {
        // Prefer Cap's canGoBack — history.length stays > 1 after SPA pushState
        // and never shrinks on back(), so it blocked the exit path forever.
        if (canGoBack) {
          rootBackArmedUntil.current = 0;
          window.history.back();
          return;
        }
        const now = Date.now();
        if (now < rootBackArmedUntil.current) {
          rootBackArmedUntil.current = 0;
          void Hardware.app.exitApp();
          return;
        }
        rootBackArmedUntil.current = now + EXIT_DOUBLE_BACK_MS;
        toast.message("Press back again to close Novend");
      })
      .then((handle) => {
        if (listenersDisposed) void handle.remove();
        else removeBackListener = handle.remove;
      });

    return () => {
      cancelled = true;
      listenersDisposed = true;
      window.clearTimeout(failOpen);
      void removeUrlListener?.();
      void removeBackListener?.();
    };
  }, [router]);

  if (gate === "checking") {
    return (
      <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium">Preparing workspace…</p>
        <p className="text-muted-foreground text-xs">Checking device security</p>
      </div>
    );
  }

  if (gate === "locked") {
    return (
      <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Fingerprint className="text-primary h-12 w-12" />
        <div>
          <h1 className="text-xl font-semibold">Unlock Novend</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Confirm it&apos;s you to continue on this device.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-12"
          onClick={() => {
            void Hardware.biometrics.authenticate("Unlock Novend POS").then((result) => {
              if (result.ok) setGate("open");
            });
          }}
        >
          Unlock with biometrics
        </Button>
        <Button type="button" variant="ghost" onClick={() => setGate("open")}>
          Continue with password session
        </Button>
      </div>
    );
  }

  return (
    <>
      {children}
      <Dialog
        open={updateOpen}
        onOpenChange={(open) => {
          if (!open && updateMandatory) return;
          setUpdateOpen(open);
        }}
      >
        <DialogContent className="max-w-md rounded-[22px]">
          <DialogHeader>
            <DialogTitle>Update available{updateVersion ? ` · ${updateVersion}` : ""}</DialogTitle>
          </DialogHeader>
          {updateHighlights.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide uppercase">What&apos;s new</p>
              <ul className="text-muted-foreground space-y-1.5 text-sm">
                {updateHighlights.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span
                      className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              A newer Novend version is ready. Update now to get the latest improvements.
            </p>
          )}
          {installedVersion ? (
            <p className="text-muted-foreground text-xs">You&apos;re on v{installedVersion}</p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {!updateMandatory ? (
              <Button type="button" variant="outline" onClick={() => setUpdateOpen(false)}>
                Later
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => {
                void Hardware.app.openStoreListing();
                if (!updateMandatory) setUpdateOpen(false);
              }}
            >
              Update now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
