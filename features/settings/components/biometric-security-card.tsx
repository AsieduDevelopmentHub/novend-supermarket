"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Hardware, type BiometricAvailability } from "@novend/hardware";
import { Fingerprint } from "lucide-react";
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

  useEffect(() => {
    void (async () => {
      const avail = await Hardware.biometrics.checkAvailability();
      if (avail.data) setAvailability(avail.data);
      const prefs = await Hardware.biometrics.getPrefs();
      setEnabled(prefs.enabled);
      setRequireOnLaunch(prefs.requireOnLaunch);
    })();
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

  if (!availability?.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="h-4 w-4" />
            Biometrics
          </CardTitle>
          <CardDescription>
            Fingerprint or face unlock is not available on this device.
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
