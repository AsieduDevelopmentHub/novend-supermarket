"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePlan } from "@/convex/shared/plans";

type Phase = "verifying" | "success" | "failed";

/**
 * Paystack returns the browser here after checkout. The webhook is the source of
 * truth, but verifying inline means the plan is live before the user gets back
 * to Settings instead of a few seconds later.
 */
export function CheckoutReturnView({ reference }: { reference: string | null }) {
  const router = useRouter();
  const verifyCheckout = useAction(api.billing.verifyCheckout);
  const [phase, setPhase] = useState<Phase>(reference ? "verifying" : "failed");
  const [message, setMessage] = useState(
    reference ? "" : "This link is missing a payment reference.",
  );
  const started = useRef(false);

  useEffect(() => {
    if (!reference || started.current) return;
    started.current = true;
    void verifyCheckout({ reference })
      .then((result) => {
        if (!result.paid) {
          setPhase("failed");
          setMessage("Payment has not been confirmed yet. Nothing was charged.");
          return;
        }
        setPhase("success");
        setMessage(
          result.planKey
            ? `Your ${resolvePlan(result.planKey).name} plan is active.`
            : "This payment was already applied to your account.",
        );
      })
      .catch((error: unknown) => {
        setPhase("failed");
        setMessage(
          error instanceof Error
            ? error.message
            : "We could not confirm this payment. If you were charged it will apply shortly.",
        );
      });
  }, [reference, verifyCheckout]);

  return (
    <div className="flex justify-center py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          {phase === "verifying" ? (
            <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden />
          ) : phase === "success" ? (
            <CheckCircle2 className="text-success h-8 w-8" aria-hidden />
          ) : (
            <CircleAlert className="text-destructive h-8 w-8" aria-hidden />
          )}
          <CardTitle className="mt-3">
            {phase === "verifying"
              ? "Confirming your payment…"
              : phase === "success"
                ? "Payment confirmed"
                : "Payment not confirmed"}
          </CardTitle>
          <CardDescription>
            {phase === "verifying"
              ? "This only takes a moment. Please keep this page open."
              : message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          {phase === "verifying" ? null : (
            <Button onClick={() => router.replace("/settings?section=billing")}>
              {phase === "success" ? "Go to billing" : "Back to billing"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
