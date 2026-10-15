"use client";

import { useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NOVEND_CONTACT_EMAIL, RECEIPT_VENDOR_FOOTER } from "@/constants/app";
import { TRIAL_DAYS } from "@/lib/millies-license";
import { toUserMessage } from "@/lib/errors";
import { useMilliesLicense } from "@/providers/millies-license-provider";
import { toast } from "sonner";

/**
 * Activate or view Millie's offline license at any time (including during trial).
 */
export function MilliesLicensePanel() {
  const { status, activate, ready } = useMilliesLicense();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await activate(key);
      setKey("");
      toast.success("License activated on this till");
    } catch (err) {
      setError(toUserMessage(err, "Could not activate license"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !status) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-5 text-sm">Checking license…</CardContent>
      </Card>
    );
  }

  const modeLabel =
    status.mode === "licensed"
      ? "Licensed"
      : status.mode === "trial"
        ? `Trial · ${status.trialDaysRemaining} day${status.trialDaysRemaining === 1 ? "" : "s"} left`
        : status.mode === "dev"
          ? "Developer bypass"
          : "Activation required";

  return (
    <div className="space-y-4">
      <Card className="rounded-[20px]">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-base">License</CardTitle>
          <CardDescription>
            Fully offline activation. Enter a key anytime — you do not need to wait for the trial
            to end.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="bg-muted space-y-2 rounded-lg p-4">
            <p>
              Status: <span className="text-foreground font-medium">{modeLabel}</span>
            </p>
            {status.customer ? (
              <p>
                Customer: <span className="text-foreground font-medium">{status.customer}</span>
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Machine ID
            </p>
            <p className="text-foreground break-all font-mono text-xs">{status.machineId}</p>
          </div>

          {status.mode === "licensed" ? (
            <p className="text-muted-foreground text-sm">
              This till is licensed. Contact Asiedu Development Hub if you need a transfer key.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <div className="space-y-2">
                <Label htmlFor="settings-millies-license-key">License key</Label>
                <Input
                  id="settings-millies-license-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="NMIL.…"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-h-11"
                />
              </div>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy || !key.trim()}>
                {busy ? "Activating…" : "Activate license"}
              </Button>
              {status.mode === "trial" ? (
                <p className="text-muted-foreground text-xs">
                  Trial lasts {TRIAL_DAYS} days. Activating a key ends the trial early and locks this
                  machine.
                </p>
              ) : null}
            </form>
          )}
          <p className="text-muted-foreground text-xs">
            {RECEIPT_VENDOR_FOOTER} · {NOVEND_CONTACT_EMAIL}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
