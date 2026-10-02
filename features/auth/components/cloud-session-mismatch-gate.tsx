"use client";

import { FormEvent, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { APP_BRAND } from "@/constants/app";
import { toUserMessage } from "@/lib/errors";
import { markExplicitLogout } from "@/lib/auth/logout-flag";
import { navigateToLoginAfterSignOut } from "@/lib/auth/native-auth-navigation";
import { resolvePostLoginSession } from "@/lib/auth/redirect-after-login";
import { withTimeout } from "@/lib/async/with-timeout";
import { storeLocalAuthVerifier } from "@/lib/offline/local-auth";

const LOGIN_DEVICE_KEY = "novend.login.deviceKey";
const CLOUD_SWITCH_BUDGET_MS = 8_000;
let volatileLoginDeviceKey: string | null = null;

export type ExpectedCloudSession = {
  userId: string;
  name: string;
  email?: string;
  organizationId?: string;
};

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

/**
 * Blocks the application shell when a remembered offline user and the current
 * Convex session belong to different accounts. No app providers, sync workers,
 * or tenant queries mount behind this gate.
 */
export function CloudSessionMismatchGate({
  session,
}: {
  session: ExpectedCloudSession;
}) {
  const { signIn, signOut } = useAuthActions();
  const convex = useConvex();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = session.email?.trim().toLowerCase() ?? "";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || !email || !password) return;
    setPending(true);
    setError(null);
    const rawPassword = password;

    try {
      await withTimeout(
        signOut(),
        CLOUD_SWITCH_BUDGET_MS,
        "Could not close the previous cloud session. Check the connection and try again.",
      );

      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", rawPassword);
      formData.set("flow", "signIn");
      formData.set("deviceKey", getLoginDeviceKey());
      await withTimeout(
        signIn("password", formData),
        CLOUD_SWITCH_BUDGET_MS,
        "Could not verify this account in time. Check the connection and try again.",
      );

      const liveSession = await resolvePostLoginSession(convex, undefined, {
        expectedEmail: email,
        expectedUserId: session.userId,
        expectedOrganizationId: session.organizationId,
      });
      const prepared = await storeLocalAuthVerifier(email, rawPassword, liveSession.userId);
      if (!prepared) {
        toast.warning("Connected, but this device could not refresh offline sign-in.");
      }
      setPassword("");
      toast.success(`${session.name} connected to cloud`);
    } catch (cause) {
      setError(
        toUserMessage(
          cause,
          "Could not connect this account. Check the password and connection, then try again.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  function openSignIn() {
    markExplicitLogout();
    void signOut().catch(() => undefined);
    void navigateToLoginAfterSignOut();
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center px-4 py-8">
      <div
        className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-session-title"
        aria-describedby="cloud-session-description"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="bg-primary/10 text-primary mb-3 flex size-12 items-center justify-center rounded-full">
            <ShieldAlert className="size-5" aria-hidden />
          </div>
          <h1 id="cloud-session-title" className="text-lg font-semibold tracking-tight">
            Verify {session.name}
          </h1>
          <p id="cloud-session-description" className="text-muted-foreground mt-1 text-sm">
            Internet is back, but another cloud session is still active. {APP_BRAND} has blocked
            the workspace to protect both accounts. Enter the password for {email || session.name}
            to reconnect safely.
          </p>
        </div>

        {email ? (
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="cloud-session-password">Password</Label>
              <PasswordInput
                id="cloud-session-password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
                required
                autoFocus
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "cloud-session-error" : undefined}
              />
            </div>
            {error ? (
              <p id="cloud-session-error" className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending || !password}>
              {pending ? "Verifying…" : "Connect to cloud"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-destructive text-sm" role="alert">
              This cached account has no email address. Open sign-in and authenticate online.
            </p>
            <Button type="button" className="w-full" onClick={openSignIn}>
              Open sign-in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
