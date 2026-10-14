"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/constants/app";
import { LoadingState } from "@/components/feedback/loading-state";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { navigateAfterLogin, resolvePostLoginPath } from "@/lib/auth/redirect-after-login";
import { trackGaEvent } from "@/lib/analytics/ga-events";

/** Completes signup by creating the owner's supermarket organization. */
export function OnboardingForm() {
  const router = useRouter();
  const convex = useConvex();
  const user = useQuery(api.users.me);
  const createOrganization = useMutation(api.organizations.create);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const onboardingTracked = useRef(false);

  useEffect(() => {
    if (onboardingTracked.current || !user) return;
    if (!user.needsOnboarding && !user.needsProfile) return;
    onboardingTracked.current = true;
    trackGaEvent("onboarding_started");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (user.isPlatformAdmin && !user.role) {
      if (!window.location.pathname.startsWith("/platform")) {
        router.replace("/platform");
      }
      return;
    }
    if (pending) return;
    if (!user.needsOnboarding && !user.needsProfile) {
      void (async () => {
        const path = await resolvePostLoginPath(convex);
        navigateAfterLogin(path, router);
      })();
    }
  }, [user, router, convex, pending]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await createOrganization({
        name,
        currency: "GHS",
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        industryProfile: "supermarket",
      });
      toast.success("Your store is ready");
      const path = await resolvePostLoginPath(convex);
      navigateAfterLogin(path, router);
    } catch (error) {
      showError(error, "Could not create your business");
    } finally {
      setPending(false);
    }
  }

  if (user === undefined) {
    return <LoadingState label="Loading…" variant="form" />;
  }

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="mb-8 space-y-3 text-center">
        <p className="text-primary text-3xl font-semibold tracking-tight">{APP_NAME}</p>
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Set up your supermarket
          </h1>
          <p className="text-muted-foreground text-sm">
            Passwords must be 12+ characters with uppercase, lowercase, and a number.
          </p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="business-name">Store name</Label>
          <Input
            id="business-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            className="h-11"
            placeholder="e.g. Milliesmart Main"
          />
        </div>
        <div className="space-y-2">
          <Label>Business type</Label>
          <p className="border-border bg-muted/40 text-foreground rounded-[12px] border px-3 py-2.5 text-sm font-medium">
            Supermarket
          </p>
          <p className="text-muted-foreground text-xs">
            Pack pricing, dated lots, and sell-by-weight for produce.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-phone">Phone (optional)</Label>
          <Input
            id="business-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={40}
            className="h-11"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-address">Address (optional)</Label>
          <Input
            id="business-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={300}
            className="h-11"
            autoComplete="street-address"
          />
        </div>
        <Button type="submit" className="h-11 w-full text-[15px] font-semibold" disabled={pending}>
          {pending ? "Creating store…" : "Create store"}
        </Button>
      </form>
    </div>
  );
}
