"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/constants/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  clearMilliesSession,
  isMilliesSetupComplete,
  milliesLogin,
  readMilliesSession,
} from "@/lib/offline/millies-auth";
import { consumeExplicitLogout } from "@/lib/auth/logout-flag";
import { toUserMessage } from "@/lib/errors";
import { MilliesSetupWizard } from "./millies-setup-wizard";

export function MilliesLoginForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const complete = await isMilliesSetupComplete();
      if (cancelled) return;
      setSetupComplete(complete);
      if (complete && readMilliesSession()) {
        router.replace("/sales");
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await milliesLogin(username, password);
      consumeExplicitLogout();
      router.replace("/sales");
    } catch (err) {
      setError(toUserMessage(err, "Invalid username or password"));
      clearMilliesSession();
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center" role="status">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!setupComplete) {
    return <MilliesSetupWizard />;
  }

  return (
    <div className={compact ? "w-full space-y-4" : "mx-auto w-full max-w-sm space-y-6"}>
      {!compact ? (
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">{APP_NAME}</h1>
          <p className="text-muted-foreground text-sm">Sign in with your local staff account</p>
        </div>
      ) : null}
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-2">
          <Label htmlFor="millies-username">Username</Label>
          <Input
            id="millies-username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="millies-password">Password</Label>
          <PasswordInput
            id="millies-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </div>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
