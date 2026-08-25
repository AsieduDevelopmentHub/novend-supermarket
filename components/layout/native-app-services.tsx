"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
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
import { RestoreLastRoute } from "@/components/layout/restore-last-route";
import { safeInternalPath } from "@/lib/auth/safe-return-path";

function parseDeepLink(url: string): string | null {
  try {
    const normalized = url.replace(/^novend:\/\//i, "https://novend.local/");
    const parsed = new URL(normalized);
    const host = parsed.hostname;
    const path = parsed.pathname.replace(/^\//, "");
    if (host === "sale" || host === "order") return path ? `/orders/${path}` : "/orders";
    if (host === "product") return path ? `/products/${path}` : "/products";
    if (host === "dashboard") return "/dashboard";
    if (host === "sales") return "/sales";
    if (parsed.pathname.startsWith("/") && parsed.pathname.length > 1) {
      return parsed.pathname + parsed.search;
    }
  } catch {
    /* ignore */
  }
  return null;
}

type Gate = "checking" | "locked" | "open";

/**
 * Capacitor-only: biometric launch gate + deep link routing + soft update check + back button.
 * All native access goes through `@novend/hardware` (no Capacitor imports here).
 */
export function NativeAppServices({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>(() => (isCapacitor() ? "checking" : "open"));
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateNotes, setUpdateNotes] = useState("");
  const [updateVersion, setUpdateVersion] = useState("");
  const [exitOpen, setExitOpen] = useState(false);

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
        const href = parseDeepLink(launch.data);
        const safe = href ? safeInternalPath(href) : null;
        if (safe) router.push(safe);
      }
      const update = await Hardware.app.checkForUpdate();
      if (update.data?.available) {
        setUpdateVersion(update.data.version || "");
        setUpdateNotes(update.data.notes || "A newer Novend build is available.");
        setUpdateOpen(true);
      }
    })();

    void Hardware.app
      .addUrlOpenListener((url) => {
        const href = parseDeepLink(url);
        const safe = href ? safeInternalPath(href) : null;
        if (safe) router.push(safe);
      })
      .then((handle) => {
        if (listenersDisposed) void handle.remove();
        else removeUrlListener = handle.remove;
      });

    void Hardware.app
      .addBackButtonListener(({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) {
          window.history.back();
          return;
        }
        setExitOpen(true);
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
      <Suspense fallback={null}>
        <RestoreLastRoute />
      </Suspense>
      {children}
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="max-w-md rounded-[22px]">
          <DialogHeader>
            <DialogTitle>Update available{updateVersion ? ` · ${updateVersion}` : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">{updateNotes}</p>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setUpdateOpen(false)}>
              Later
            </Button>
            <Button
              type="button"
              onClick={() => {
                void Hardware.app.openStoreListing();
                setUpdateOpen(false);
              }}
            >
              Update now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="max-w-sm rounded-[22px]">
          <DialogHeader>
            <DialogTitle>Leave Novend?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            You are at the start of this session. Close the app, or stay and keep working.
          </p>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setExitOpen(false)}>
              Stay
            </Button>
            <Button
              type="button"
              onClick={() => {
                void Hardware.app.exitApp();
                setExitOpen(false);
              }}
            >
              Close app
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
