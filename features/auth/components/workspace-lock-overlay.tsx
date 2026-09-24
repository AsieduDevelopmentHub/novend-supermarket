"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Fingerprint, Lock } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { APP_BRAND } from "@/constants/app";
import { useConnectivity } from "@/hooks/use-connectivity";
import { Hardware, hasNovendNativeSecurity } from "@novend/hardware";
import { showError } from "@/lib/errors";

type WorkspaceLockOverlayProps = {
  userName: string | null;
  onUnlocked: () => void;
};

/**
 * Full-screen till lock. Mount only while locked so form state remounts clean.
 * Focus stays inside the overlay; Escape does not dismiss.
 * Password unlock uses Convex Auth (`users.verifyPassword`). Biometrics are optional.
 */
export function WorkspaceLockOverlay({ userName, onUnlocked }: WorkspaceLockOverlayProps) {
  const online = useConnectivity();
  const verifyPassword = useAction(api.users.verifyPassword);
  const titleId = useId();
  const descId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => passwordRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasNovendNativeSecurity()) return;
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await Hardware.biometrics.getPrefs();
        if (!prefs.enabled) return;
        const avail = await Hardware.biometrics.checkAvailability();
        if (!cancelled) {
          setBiometricAvailable(Boolean(avail.data?.available && avail.data?.enrolled));
        }
      } catch {
        // Keep default false.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function onFocusIn(event: FocusEvent) {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) {
        passwordRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  /**
   * Unmount after the activating gesture finishes. Removing the unlock control
   * mid-click can leave Chromium/Electron unable to hit-test the shell until a
   * full reload — the page looks "stuck" behind a vanished lock screen.
   */
  function finishUnlock() {
    setPassword("");
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.setTimeout(() => onUnlocked(), 0);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;
    if (!online) {
      setError(
        biometricAvailable
          ? "Password unlock needs a connection. Use biometrics, or reconnect."
          : "Password unlock needs a connection. Reconnect to continue.",
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      await verifyPassword({ password });
      finishUnlock();
    } catch (err) {
      setError("Incorrect password");
      showError(err, "Incorrect password");
      setPending(false);
    }
  }

  async function onBiometricUnlock() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await Hardware.biometrics.authenticate("Unlock Novend POS");
      if (result.ok) {
        finishUnlock();
      } else if (result.message !== "Cancelled") {
        setError(result.message || "Biometrics failed");
        setPending(false);
      } else {
        setPending(false);
      }
    } catch {
      setError("Biometrics failed");
      setPending(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="bg-background/95 fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-lg">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="bg-primary/10 text-primary mb-3 flex size-12 items-center justify-center rounded-full">
            <Lock className="size-5" aria-hidden />
          </div>
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {APP_BRAND} is locked
          </h2>
          <p id={descId} className="text-muted-foreground mt-1 text-sm">
            {userName
              ? `Enter the password for ${userName} to continue on this till.`
              : "Enter your password to continue on this till."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="workspace-lock-password">Password</Label>
            <PasswordInput
              ref={passwordRef}
              id="workspace-lock-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "workspace-lock-error" : undefined}
            />
          </div>
          {error ? (
            <p id="workspace-lock-error" className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {!online ? (
            <p className="text-muted-foreground text-xs">
              Offline: password unlock needs a connection
              {biometricAvailable ? "; biometrics still work on this device." : "."}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending || !password}>
            {pending ? "Unlocking…" : "Unlock"}
          </Button>
        </form>

        {biometricAvailable ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            disabled={pending}
            onClick={() => void onBiometricUnlock()}
          >
            <Fingerprint className="mr-2 size-4" aria-hidden />
            Unlock with biometrics
          </Button>
        ) : null}
      </div>
    </div>
  );
}
