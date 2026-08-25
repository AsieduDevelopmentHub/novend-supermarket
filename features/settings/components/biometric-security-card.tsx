"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Hardware,
  NATIVE_SETTINGS_PROBE_MS,
  type BiometricAvailability,
} from "@novend/hardware";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { runNativeSettingsCheck } from "@/features/settings/native-settings-check";

type BiometricUiState =
  | "checking"
  | "available"
  | "unavailable"
  | "unsupported"
  | "error";

/**
 * Optional biometric unlock — never stores the account password.
 * Secure storage keeps only a device unlock token after the user opts in.
 *
 * Do not re-probe Cap biometrics on app resume — that races camera/gallery
 * return and can freeze the WebView bridge.
 */
export function BiometricSecurityCard() {
  const [uiState, setUiState] = useState<BiometricUiState>("checking");
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [requireOnLaunch, setRequireOnLaunch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checkGenerationRef = useRef(0);

  const refreshAvailability = useCallback(async (showLoading: boolean) => {
    const generation = ++checkGenerationRef.current;
    if (showLoading) {
      setUiState("checking");
      setMessage(null);
    }
    const hardStop = window.setTimeout(() => {
      if (generation !== checkGenerationRef.current) return;
      setUiState("error");
      setMessage("Biometrics took too long to respond on this device.");
    }, NATIVE_SETTINGS_PROBE_MS * 2 + 500);

    try {
      const [avail, prefs] = await runNativeSettingsCheck(() =>
        Promise.all([
          Hardware.biometrics.checkAvailability(),
          Hardware.biometrics.getPrefs(),
        ]),
      );
      if (generation !== checkGenerationRef.current) return;
      const data = avail.data ?? {
        available: false,
        supported: false,
        enrolled: false,
        biometryType: "none" as const,
      };
      setAvailability(data);
      setEnabled(prefs.enabled);
      setRequireOnLaunch(prefs.requireOnLaunch);

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
    } finally {
      window.clearTimeout(hardStop);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    // Defer so the Security tab paints before Cap probes run.
    const start = window.setTimeout(() => {
      if (disposed) return;
      void refreshAvailability(true);
    }, 120);
    return () => {
      disposed = true;
      checkGenerationRef.current += 1;
      window.clearTimeout(start);
    };
  }, [refreshAvailability]);

  async function onToggleEnabled(next: boolean) {
    if (busy) return;
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
    if (!enabled || busy) return;
    await Hardware.biometrics.setRequireOnLaunch(next);
    setRequireOnLaunch(next);
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
              setUiState("error");
              setMessage("Biometrics check cancelled. You can try again when ready.");
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
        {uiState === "error" ? (
          <CardContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshAvailability(true)}
            >
              Try again
            </Button>
          </CardContent>
        ) : null}
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
