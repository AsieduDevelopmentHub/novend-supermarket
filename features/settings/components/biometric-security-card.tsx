"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Hardware, hasNovendNativeSecurity, type BiometricAvailability } from "@novend/hardware";
import { randomUuid } from "@/convex/shared/randomId";
import { runNativeSettingsCheck } from "@/features/settings/native-settings-check";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";

type BiometricUiState = "idle" | "checking" | "available" | "unavailable" | "unsupported" | "error";

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 80);
  });
}

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
  const [justVerified, setJustVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checkGenerationRef = useRef(0);
  const enabledRef = useRef(false);

  const refreshAvailability = useCallback(async (opts?: { quiet?: boolean }) => {
    const generation = ++checkGenerationRef.current;
    if (!opts?.quiet) {
      setUiState("checking");
      setMessage(null);
    }
    try {
      const avail = await runNativeSettingsCheck(() => Hardware.biometrics.checkAvailability());
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
      if (opts?.quiet && enabledRef.current) {
        // Keep showing controls after a successful verify — do not blank the card.
        setUiState("available");
        return;
      }
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
        enabledRef.current = prefs.enabled;
        setEnabled(prefs.enabled);
        setRequireOnLaunch(prefs.requireOnLaunch);
        // Show controls immediately when already enabled so remount never looks blank.
        if (prefs.enabled) {
          setUiState("available");
          setAvailability({
            available: true,
            supported: true,
            enrolled: true,
            biometryType: "fingerprint",
          });
        }
      } catch {
        /* prefs are best-effort */
      }
      if (!cancelled && hasNovendNativeSecurity()) {
        await refreshAvailability({ quiet: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAvailability]);

  async function onToggleEnabled(next: boolean) {
    if (busy) return;
    setBusy(true);
    setJustVerified(false);
    // Let the switch/busy paint before the sync native prompt blocks the WebView.
    await yieldToUi();
    try {
      if (next) {
        if (uiState !== "available") {
          await refreshAvailability();
        }
        const auth = await Hardware.biometrics.authenticate(
          "Enable biometric unlock for Novend POS",
        );
        // Yield after BiometricPrompt so the WebView can paint before more work.
        await yieldToUi();
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
        const enabledResult = await Hardware.biometrics.setEnabled(true);
        if (!enabledResult.ok) {
          toast.error(enabledResult.message || "Could not enable biometrics");
          return;
        }
        enabledRef.current = true;
        setEnabled(true);
        setJustVerified(true);
        setUiState("available");
        if (!availability?.available) {
          setAvailability({
            available: true,
            supported: true,
            enrolled: true,
            biometryType: availability?.biometryType ?? "fingerprint",
          });
        }
        toast.success("Biometrics enabled");
      } else {
        await Hardware.biometrics.setEnabled(false);
        enabledRef.current = false;
        setEnabled(false);
        setRequireOnLaunch(false);
        setJustVerified(false);
        toast.message("Biometrics disabled");
      }
    } catch {
      toast.error("Could not configure biometrics. Try again.");
    } finally {
      await yieldToUi();
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
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Biometrics are enabled on this device.
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshAvailability()}
          >
            Check device support
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (uiState === "checking" && !enabled) {
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
    if (enabled) {
      // Prefer showing enabled controls over a blank/error card after verify.
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
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Biometrics are enabled on this device.
            </p>
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
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onToggleEnabled(false)}
            >
              Disable biometrics
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
            {uiState === "error" ? "Try again" : "Check again"}
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
        {justVerified || enabled ? (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {justVerified
              ? "Verified — biometric unlock is on for this device."
              : "Biometric unlock is on for this device."}
          </p>
        ) : null}
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
