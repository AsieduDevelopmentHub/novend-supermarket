"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Hardware, type BiometricAvailability } from "@novend/hardware";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Optional biometric unlock — never stores the account password.
 * Secure storage keeps only a device unlock token after the user opts in.
 */
export function BiometricSecurityCard() {
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [requireOnLaunch, setRequireOnLaunch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const avail = await Hardware.biometrics.checkAvailability();
        if (cancelled) return;
        if (avail.data) setAvailability(avail.data);
        else setAvailability({ available: false, biometryType: "none" });
        if (!avail.ok && avail.message) setLoadError(avail.message);
        const prefs = await Hardware.biometrics.getPrefs();
        if (cancelled) return;
        setEnabled(prefs.enabled);
        setRequireOnLaunch(prefs.requireOnLaunch);
      } catch {
        if (!cancelled) {
          setAvailability({ available: false, biometryType: "none" });
          setLoadError("Could not check biometrics on this device.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onToggleEnabled(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const auth = await Hardware.biometrics.authenticate(
          "Enable biometric unlock for Novend POS",
        );
        if (!auth.ok) {
          if (auth.message !== "Cancelled") toast.error(auth.message || "Biometrics failed");
          return;
        }
        const token = `novend-unlock-${crypto.randomUUID()}`;
        const stored = await Hardware.biometrics.storeUnlockToken(token);
        if (!stored.ok) {
          toast.error(stored.message || "Could not enable biometrics");
          return;
        }
        await Hardware.biometrics.setEnabled(true);
        setEnabled(true);
        toast.success("Biometrics enabled");
      } else {
        await Hardware.biometrics.setEnabled(false);
        setEnabled(false);
        setRequireOnLaunch(false);
        toast.message("Biometrics disabled");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onToggleRequire(next: boolean) {
    if (!enabled) return;
    await Hardware.biometrics.setRequireOnLaunch(next);
    setRequireOnLaunch(next);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="h-4 w-4" />
            Biometrics
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Checking this device…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!availability?.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="h-4 w-4" />
            Biometrics
          </CardTitle>
          <CardDescription>
            {loadError ?? "Fingerprint or face unlock is not available on this device."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="h-4 w-4" />
          Biometrics
        </CardTitle>
        <CardDescription>
          Optional {availability.biometryType} unlock. Your password is never stored on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Enable biometrics</p>
            <p className="text-muted-foreground text-xs">Unlock Novend after you sign in once</p>
          </div>
          <Switch
            checked={enabled}
            disabled={busy}
            onCheckedChange={(checked) => void onToggleEnabled(checked)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Require on app launch</p>
            <p className="text-muted-foreground text-xs">Prompt each time Novend opens</p>
          </div>
          <Switch
            checked={requireOnLaunch}
            disabled={!enabled || busy}
            onCheckedChange={(checked) => void onToggleRequire(checked)}
          />
        </div>
        {enabled ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void onToggleEnabled(false)}
          >
            Disable biometrics
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
