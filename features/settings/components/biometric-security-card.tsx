"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Hardware, hasNovendNativeSecurity, type BiometricAvailability } from "@novend/hardware";
import { randomUuid } from "@/convex/shared/randomId";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";

type BiometricUiState =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "unsupported"
  | "error";

/**
 * Optional biometric unlock — never stores the account password.
 * Status and the system prompt go through window.NovendNative, not Cap plugins.
 */
export function BiometricSecurityCard() {
  const [uiState, setUiState] = useState<BiometricUiState>("idle");
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [requireOnLaunch, setRequireOnLaunch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checkGenerationRef = useRef(0);

  const refreshAvailability = useCallback(async () => {
    const generation = ++checkGenerationRef.current;
    setUiState("checking");
    setMessage(null);
    try {
      const avail = await Hardware.biometrics.checkAvailability();
      if (generation !== checkGenerationRef.current) return;
      const data = avail.data ?? {
        available: false,
        supported: false,
        enrolled: false,
        biometryType: "none" as const,
      };
      setAvailability(data);

      if (!avail.ok) {
        setUiState("error");
        setMessage(avail.message || "Could not check biometrics on this device.");
      } else if (!data.supported || data.biometryType === "none") {
        setUiState("unsupported");
        setMessage("This device does not support fingerprint or face unlock.");
      } else if (!data.available || !data.enrolled) {
        setUiState("unavailable");
        setMessage(
          data.reason ||
            "Biometrics are supported but not set up. Add a fingerprint or face unlock in device settings, then return here.",
        );
      } else {
        setUiState("available");
        setMessage(null);
      }
    } catch {
      if (generation !== checkGenerationRef.current) return;
      setAvailability({
        available: false,
        supported: false,
        enrolled: false,
        biometryType: "none",
      });
      setUiState("error");
      setMessage("Could not check biometrics on this device.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await Hardware.biometrics.getPrefs();
        if (cancelled) return;
        setEnabled(prefs.enabled);
        setRequireOnLaunch(prefs.requireOnLaunch);
      } catch {
        /* prefs are best-effort */
      }
      if (!cancelled && hasNovendNativeSecurity()) await refreshAvailability();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAvailability]);

  async function onToggleEnabled(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        if (uiState !== "available") {
          await refreshAvailability();
        }
        const auth = await Hardware.biometrics.authenticate(
          "Enable biometric unlock for Novend POS",
        );
        if (!auth.ok) {
          if (auth.message !== "Cancelled") toast.error(auth.message || "Biometrics failed");
          return;
        }
        const token = `novend-unlock-${randomUuid()}`;
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
    if (!enabled || busy) return;
    await Hardware.biometrics.setRequireOnLaunch(next);
    setRequireOnLaunch(next);
  }

  if (uiState === "idle") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="h-4 w-4" />
            Biometrics
          </CardTitle>
          <CardDescription>
            Optional fingerprint or face unlock. Your password is never stored on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {enabled ? (
            <p className="text-muted-foreground text-sm">Biometrics are enabled on this device.</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshAvailability()}>
            Check device support
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (uiState === "checking") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="h-4 w-4" />
            Biometrics
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Checking biometrics on this device…
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              checkGenerationRef.current += 1;
              setUiState("idle");
              setMessage(null);
            }}
          >
            Cancel check
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (uiState !== "available" || !availability?.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="h-4 w-4" />
            Biometrics
          </CardTitle>
          <CardDescription>
            {message ?? "Fingerprint or face unlock is not available on this device."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshAvailability()}
          >
            Try again
          </Button>
        </CardContent>
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
