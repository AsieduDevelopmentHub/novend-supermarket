"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { Mail } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { APP_NAME } from "@/constants/app";
import { LoadingState } from "@/components/feedback/loading-state";
import { cn } from "@/lib/utils";

const REMEMBER_KEY = "novend.login.rememberEmail";

export function LoginForm({ compact = false }: { compact?: boolean }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  if (!configured) {
    return (
      <div className="w-full max-w-sm space-y-3 text-center">
        <h1 className="text-xl font-semibold">Connect Convex</h1>
        <p className="text-muted-foreground text-sm">
          Run <code className="bg-muted rounded px-1">npx convex dev</code>, copy the deployment URL
          into <code className="bg-muted rounded px-1">.env.local</code> as{" "}
          <code className="bg-muted rounded px-1">NEXT_PUBLIC_CONVEX_URL</code>, then restart the
          Next.js server.
        </p>
      </div>
    );
  }

  return <ConfiguredLoginForm compact={compact} />;
}

function ConfiguredLoginForm({ compact }: { compact: boolean }) {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const router = useRouter();
  const registration = useQuery(api.users.registrationStatus);
  const recordLoginFailure = useMutation(api.loginGuards.recordLoginFailure);
  const clearLoginFailures = useMutation(api.loginGuards.clearLoginFailures);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);

  const isProvisioned = registration?.hasUsers === true;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(REMEMBER_KEY);
        if (saved) {
          setEmail(saved);
          setRememberMe(true);
        }
      } catch {
        /* ignore storage errors */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isProvisioned) {
      toast.error(
        "System is not provisioned yet. Run the bootstrap CLI to create the administrator.",
      );
      return;
    }

    setPending(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await convex.query(api.loginGuards.assertLoginAllowed, { email: normalizedEmail });

      try {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_KEY, normalizedEmail);
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* ignore storage errors */
      }

      const formData = new FormData();
      formData.set("email", normalizedEmail);
      formData.set("password", password);
      formData.set("flow", "signIn");
      await signIn("password", formData);
      try {
        await clearLoginFailures({});
      } catch {
        /* non-fatal */
      }
      toast.success("Welcome");
      router.replace("/dashboard");
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      if (raw.toLowerCase().includes("auth provider discovery")) {
        toast.error(
          "Auth could not reach Convex. Check NEXT_PUBLIC_CONVEX_URL / SITE_URL and restart Next.js.",
        );
      } else if (raw.toLowerCase().includes("too many failed")) {
        showError(error, "Too many failed sign-in attempts.");
      } else {
        try {
          await recordLoginFailure({ email: normalizedEmail });
        } catch (lockError) {
          const lockMsg = lockError instanceof Error ? lockError.message : "";
          if (lockMsg.toLowerCase().includes("too many failed")) {
            showError(lockError, "Too many failed sign-in attempts.");
            return;
          }
          // Rate-limit bookkeeping must never replace the sign-in error (e.g. deploy lag).
        }
        showError(error, "Sign in failed. Check your email and password.");
      }
    } finally {
      setPending(false);
    }
  }

  if (registration === undefined) {
    return (
      <div className="w-full max-w-[360px] py-10">
        <LoadingState label="Loading…" variant="form" />
      </div>
    );
  }

  if (!isProvisioned) {
    return (
      <div className="mx-auto w-full max-w-[360px]">
        <div className={cn("text-center", compact ? "mb-6 space-y-1" : "mb-8 space-y-1")}>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            System not provisioned
          </h1>
          <p className="text-muted-foreground text-sm">{APP_NAME}</p>
        </div>
        <p className="bg-muted text-muted-foreground rounded-lg px-3 py-3 text-left text-sm leading-relaxed">
          No administrator exists yet. The system owner must create the first administrator with the
          secure bootstrap CLI (
          <code className="bg-card rounded px-1 text-xs">pnpm bootstrap:admin</code>
          ). Public registration is disabled.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[360px]">
        <div className={cn(compact ? "mb-6 space-y-1" : "mb-8 space-y-1")}>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Business login</p>
        </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className="bg-muted/50 h-11 pr-10"
              required
            />
            <Mail
              className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-muted/50 h-11"
            required
            minLength={8}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(value) => setRememberMe(value === true)}
              aria-label="Remember me"
            />
            <span className="text-foreground/90">Remember me</span>
          </label>
          <button
            type="button"
            className="text-primary text-sm font-medium hover:underline"
            onClick={() =>
              toast.message("Ask your administrator to reset your password. Public reset is disabled.")
            }
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" className="h-11 w-full text-[15px] font-semibold" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-8 text-sm leading-relaxed">
        Accounts are created by your administrator. Contact them if you need access.
      </p>
    </div>
  );
}
