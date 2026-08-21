"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import { describeClientDevice, setStoredDeviceName } from "@/lib/device";
import { toUserMessage } from "@/lib/errors";

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type DeviceActivationStatus = "idle" | "registered" | "blocked";

export type DeviceActivation = {
  status: DeviceActivationStatus;
  message: string | null;
};

/**
 * Registers this installation as a licensed device once per session, then keeps
 * its last-seen time current. A rejected registration never blocks the app — it
 * surfaces so an administrator can free a slot or upgrade.
 */
export function useDeviceActivation(enabled: boolean): DeviceActivation {
  const online = useConnectivity();
  const registerDevice = useMutation(api.devices.registerDevice);
  const touchDevice = useMutation(api.devices.touchDevice);
  const [status, setStatus] = useState<DeviceActivationStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!enabled || !online || attempted.current) return;
    attempted.current = true;

    let cancelled = false;
    let interval: number | undefined;

    void (async () => {
      const identity = await describeClientDevice();
      if (cancelled || !identity.fingerprint) return;
      try {
        await registerDevice({
          fingerprint: identity.fingerprint,
          name: identity.name,
          platform: identity.platform,
          runtime: identity.runtime,
          appVersion: identity.appVersion,
        });
        if (cancelled) return;
        setStoredDeviceName(identity.name);
        setStatus("registered");
        setMessage(null);
        interval = window.setInterval(() => {
          void touchDevice({ fingerprint: identity.fingerprint }).catch(() => {
            /* presence only — never surface */
          });
        }, TOUCH_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;
        setStatus("blocked");
        setMessage(toUserMessage(error, "This device could not be activated."));
        // Allow a retry after connectivity or plan changes.
        attempted.current = false;
      }
    })();

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [enabled, online, registerDevice, touchDevice]);

  return { status, message };
}
