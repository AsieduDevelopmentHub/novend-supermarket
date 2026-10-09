"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import { Cloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { showError } from "@/lib/errors";
import {
  clearOnlineSessionWarm,
  isOnlineSessionWarm,
  markOnlineSessionWarm,
  resolvePostLoginSession,
} from "@/lib/auth/redirect-after-login";
import { consumeExplicitLogout, hasExplicitLogout } from "@/lib/auth/logout-flag";
import { clearLocalOnlyCloudUser } from "@/lib/auth/awaiting-cloud-reconnect";
import { withTimeout } from "@/lib/async/with-timeout";
import { storeLocalAuthVerifier } from "@/lib/offline/local-auth";
import {
  hasOfflineSession,
  listOfflineSessions,
  type OfflineSessionHint,
} from "@/lib/offline/session";
import { useOfflineSessionHint } from "@/hooks/use-offline-session-hint";
import { useOfflineStatus } from "@/providers/offline-provider";
import { cn } from "@/lib/utils";

const LOGIN_DEVICE_KEY = "novend.login.deviceKey";
const REMEMBER_KEY = "novend.login.rememberEmail";
const DISMISS_KEY = "novend.cloudReconnect.dismissedAt";
/** Re-show the banner after dismiss once this window elapses (same shift). */
const DISMISS_TTL_MS = 30 * 60 * 1000;
/** Let Convex auth settle after the radio flips before auto-opening the dialog. */
const AUTO_OPEN_SETTLE_MS = 900;
/** Password sign-in must not hang the Connect dialog forever on a flaky radio. */
const RECONNECT_SIGNIN_BUDGET_MS = 20_000;
const RECONNECT_REQUEST_EVENT = "novend:request-cloud-reconnect";

let volatileLoginDeviceKey: string | null = null;

function getLoginDeviceKey(): string {
  if (volatileLoginDeviceKey) return volatileLoginDeviceKey;
  try {
    const stored = window.localStorage.getItem(LOGIN_DEVICE_KEY);
    if (stored) {
      volatileLoginDeviceKey = stored;
      return stored;
    }
    const created = crypto.randomUUID();
    window.localStorage.setItem(LOGIN_DEVICE_KEY, created);
    volatileLoginDeviceKey = created;
    return created;
  } catch {
    volatileLoginDeviceKey = crypto.randomUUID();
    return volatileLoginDeviceKey;
  }
}

function readRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REMEMBER_KEY)?.trim().toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function resolveReconnectEmail(hint: OfflineSessionHint | null): string {
  const fromHint = hint?.email?.trim().toLowerCase();
  if (fromHint) return fromHint;
  try {
    const sessions = listOfflineSessions();
    const active =
      (hint?.userId ? sessions.find((row) => row.userId === hint.userId) : null) ?? sessions[0];
    const fromRegistry = active?.email?.trim().toLowerCase();
    if (fromRegistry) return fromRegistry;
  } catch {
    /* ignore */
  }
  return readRememberedEmail();
}

function readDismissedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeDismissedAt(at: number) {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, String(at));
  } catch {
    /* private mode */
  }
}

function clearDismissedAt() {
  try {
    window.sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    /* private mode */
  }
}

/** Clear a prior dismiss so the Connect-to-cloud banner can offer password sign-in again. */
export function requestCloudReconnectPrompt() {
  clearDismissedAt();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RECONNECT_REQUEST_EVENT));
  }
}

/**
 * When the radio returns but the till is still on an offline shell (no Convex
 * JWT), offer an in-place password connect so the cashier stays on the current
 * POS route and queued work can upload.
 */
export function CloudReconnectBanner() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { online, flushOutbox, pullSnapshot } = useOfflineStatus();
  const sessionHint = useOfflineSessionHint();
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const autoOpenedRef = useRef(false);

  const email = resolveReconnectEmail(sessionHint);
  const reconnectSession =
    sessionHint ??
    listOfflineSessions().find((row) => row.email?.trim().toLowerCase() === email) ??
    null;
  const hasShell = Boolean(sessionHint) || hasOfflineSession();
  // Online password login is authoritative while Convex Auth settles — never
  // offer Connect / “Checking cloud session” over a fresh credential leave.
  const onlineLoginWarm = isOnlineSessionWarm();
  // Keep reconnect UI across Convex isLoading flicker — gating on !isLoading
  // briefly unmounted the password dialog and dropped forceClientShell → /login.
  const shellEligible =
    online &&
    !isAuthenticated &&
    hasShell &&
    Boolean(email) &&
    !hasExplicitLogout() &&
    !onlineLoginWarm;
  const canAutoOpen = shellEligible && !isLoading;

  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (isAuthenticated && onlineLoginWarm) {
      clearOnlineSessionWarm();
    }
  }, [isAuthenticated, onlineLoginWarm]);

  useEffect(() => {
    if (shellEligible) {
      const at = readDismissedAt();
      setDismissed(at > 0 && Date.now() - at < DISMISS_TTL_MS);
      return;
    }
    // Only reset when leaving reconnect mode for real (not auth-loading flicker).
    if (!online || isAuthenticated || !hasShell) {
      clearDismissedAt();
      setDismissed(false);
      autoOpenedRef.current = false;
      setDialogOpen(false);
    }
  }, [shellEligible, online, isAuthenticated, hasShell]);

  useEffect(() => {
    if (!canAutoOpen || dismissed || autoOpenedRef.current) return;
    const timer = window.setTimeout(() => {
      if (autoOpenedRef.current) return;
      autoOpenedRef.current = true;
      setDialogOpen(true);
    }, AUTO_OPEN_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [canAutoOpen, dismissed]);

  useEffect(() => {
    if (!shellEligible) return;
    function onFocus() {
      const at = readDismissedAt();
      if (at > 0 && Date.now() - at >= DISMISS_TTL_MS) {
        clearDismissedAt();
        setDismissed(false);
      }
    }
    function onReconnectRequest() {
      clearDismissedAt();
      setDismissed(false);
      setDialogOpen(true);
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener(RECONNECT_REQUEST_EVENT, onReconnectRequest);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(RECONNECT_REQUEST_EVENT, onReconnectRequest);
    };
  }, [shellEligible]);

  // Stay mounted while the dialog is open even if Convex flips isLoading.
  if (!shellEligible && !dialogOpen) return null;
  if (shellEligible && dismissed && !dialogOpen) return null;

  function dismiss() {
    writeDismissedAt(Date.now());
    setDismissed(true);
    setDialogOpen(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const rawPassword = password;
    if (!email || !rawPassword) return;
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", rawPassword);
      formData.set("flow", "signIn");
      formData.set("deviceKey", getLoginDeviceKey());
      // Drop a leftover signed-out latch before password sign-in so a slow
      // users.me cannot bounce this till back to unauthenticated mid-connect.
      consumeExplicitLogout();
      await withTimeout(
        signIn("password", formData),
        RECONNECT_SIGNIN_BUDGET_MS,
        "Couldn't reach Novend in time. Check the connection and try again.",
      );
      // Hide Connect / “Checking cloud session” while the socket and JWT settle.
      markOnlineSessionWarm();
      const liveSession = await resolvePostLoginSession(convex, undefined, {
        expectedEmail: email,
        expectedUserId: reconnectSession?.userId,
        expectedOrganizationId: reconnectSession?.organizationId,
      });
      // A prior Continue locally choice is session-scoped. Successful password
      // reconnect must release the layout's query quarantine immediately.
      clearLocalOnlyCloudUser();
      try {
        await storeLocalAuthVerifier(email, rawPassword, liveSession.userId);
      } catch {
        /* verifier refresh is best-effort */
      }
      clearDismissedAt();
      setDialogOpen(false);
      setPassword("");
      toast.success("Connected to cloud");
      void pullSnapshot().then(() =>
        flushOutbox({ force: true, showProgress: true }),
      );
    } catch (error) {
      clearOnlineSessionWarm();
      showError(error, "Could not connect. Check your password and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {shellEligible && !dismissed ? (
        <div
          role="status"
          className={cn(
            "border-primary/25 bg-primary/10 text-foreground flex items-center justify-between gap-3 border-b px-4 py-2 text-sm",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Cloud className="text-primary size-4 shrink-0" aria-hidden />
            <p className="truncate">
              {isLoading ? "Checking cloud session…" : "Internet is back — connect to sync"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
              Connect
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="size-8 px-0"
              aria-label="Dismiss for now"
              onClick={dismiss}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle id={titleId}>Connect to cloud</DialogTitle>
            <DialogDescription>
              Enter your password for {email}. You stay on this screen — queued sales and stock
              changes upload after you connect.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="cloud-reconnect-password">Password</Label>
              <PasswordInput
                id="cloud-reconnect-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                required
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !password}>
                {pending ? "Connecting…" : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
