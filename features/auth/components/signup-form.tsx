"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import Image from "next/image";
import { Mail, User } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { ROUTES } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function SignupForm({ compact = false }: { compact?: boolean }) {
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

  return <ConfiguredSignupForm compact={compact} />;
}

function ConfiguredSignupForm({ compact }: { compact: boolean }) {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    void router.refresh();
    router.replace("/onboarding");
  }, [isAuthenticated, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!acceptedLegal) {
      toast.error("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("email", email.trim().toLowerCase());
      formData.set("password", password);
      formData.set("name", name.trim());
      formData.set("flow", "signUp");
      await signIn("password", formData);
      toast.success("Account created");
      void router.refresh();
    } catch (error) {
      showError(error, "Could not create account. Try a different email.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className={cn("text-center", compact ? "mb-6 space-y-3" : "mb-8 space-y-4")}>
        <div className={cn("relative mx-auto", compact ? "h-14 w-14" : "h-16 w-16")}>
          <Image
            src={BRANDING.brandmark}
            alt=""
            fill
            priority
            sizes="64px"
            className="object-contain"
          />
        </div>
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Create your account
          </h1>
          <p className="text-muted-foreground text-sm">{APP_NAME}</p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <div className="relative">
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ama Mensah"
              className="bg-muted/50 h-11 pr-10"
              required
            />
            <User
              className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
          </div>
        </div>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-muted/50 h-11"
            required
            minLength={8}
          />
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="accept-legal"
            checked={acceptedLegal}
            onCheckedChange={(value) => setAcceptedLegal(value === true)}
            className="mt-0.5"
            aria-describedby="accept-legal-hint"
          />
          <div className="space-y-1">
            <Label htmlFor="accept-legal" className="text-sm leading-relaxed font-normal">
              I agree to the{" "}
              <Link
                href={ROUTES.terms}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href={ROUTES.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </Label>
            <p id="accept-legal-hint" className="text-muted-foreground text-xs leading-relaxed">
              Required before creating an account.
            </p>
          </div>
        </div>

        <Button
          type="submit"
          className="h-11 w-full text-[15px] font-semibold"
          disabled={pending || !acceptedLegal}
        >
          {pending ? "Creating account…" : "Start free trial"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
      <p className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
        Then set up your business. Staff accounts are created by your administrator.
      </p>
    </div>
  );
}
