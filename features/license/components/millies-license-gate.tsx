"use client";

import { useState, type FormEvent } from "react";
import { APP_NAME, NOVEND_CONTACT_EMAIL, RECEIPT_VENDOR_FOOTER } from "@/constants/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TRIAL_DAYS } from "@/lib/millies-license";
import { toUserMessage } from "@/lib/errors";
import { useMilliesLicense } from "@/providers/millies-license-provider";

/** Blocking screen when trial ended / not started, or license is invalid. Fully offline. */
export function MilliesLicenseGate() {
  const { status, activate, startTrial } = useMilliesLicense();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trialAvailable = Boolean(status && status.trialStartedAt <= 0);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await activate(key);
      setKey("");
    } catch (err) {
      setError(toUserMessage(err, "Could not activate license"));
    } finally {
      setBusy(false);
    }
  }

  async function onStartTrial() {
    setBusy(true);
    setError(null);
    try {
      await startTrial();
    } catch (err) {
      setError(toUserMessage(err, "Could not start trial"));
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="bg-background text-muted-foreground flex min-h-dvh items-center justify-center p-6 text-sm">
        Checking license…
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
            License required
          </p>
          <CardTitle className="text-2xl">Activate {APP_NAME}</CardTitle>
          <CardDescription>
            {status.reason ??
              `Your ${TRIAL_DAYS}-day trial has ended. Enter a license key issued for this store. No internet required.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted space-y-2 rounded-lg p-4 text-sm">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Machine ID
            </p>
            <p className="text-foreground break-all font-mono text-xs">{status.machineId}</p>
            <p className="text-muted-foreground text-xs">
              Include this ID when requesting a machine-locked key from Asiedu Development Hub.
            </p>
          </div>

          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="millies-license-key">License key</Label>
              <Input
                id="millies-license-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="NMIL.…"
                required={!trialAvailable}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy || !key.trim()}>
              {busy ? "Activating…" : "Activate license"}
            </Button>
          </form>

          {trialAvailable ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => void onStartTrial()}
            >
              Start {TRIAL_DAYS}-day offline trial
            </Button>
          ) : null}

          <p className="text-muted-foreground text-center text-xs">
            {RECEIPT_VENDOR_FOOTER}
            <br />
            {NOVEND_CONTACT_EMAIL}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
