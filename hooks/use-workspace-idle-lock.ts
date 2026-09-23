"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createIdleLockState,
  IDLE_LOCK_TIMEOUT_EVENT,
  IDLE_LOCK_TIMEOUT_KEY,
  lockIdleWorkspace,
  parseIdleLockTimeout,
  readIdleLockTimeout,
  recordIdleActivity,
  setIdleLockTimeout,
  tickIdleLock,
  unlockIdleWorkspace,
  writeIdleLockTimeout,
  type IdleLockTimeoutMinutes,
} from "@/lib/offline/idle-lock";
import { clearCustomerDisplaySnapshot } from "@/lib/sales/customer-display";

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "mousemove",
  "touchstart",
  "scroll",
  "wheel",
];

const TICK_MS = 5_000;
const ACTIVITY_THROTTLE_MS = 1_000;

type UseWorkspaceIdleLockOptions = {
  enabled: boolean;
};

/**
 * Watches pointer/keyboard activity and locks the authenticated shell after idle.
 * Clears the customer-facing display when locking so a second screen does not keep showing cart data.
 */
export function useWorkspaceIdleLock({ enabled }: UseWorkspaceIdleLockOptions) {
  const [state, setState] = useState(() => createIdleLockState(readIdleLockTimeout()));
  const lastActivityWriteRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    function onTimeoutChange(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      const minutes = parseIdleLockTimeout(detail ?? readIdleLockTimeout());
      setState((current) => setIdleLockTimeout(current, minutes));
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== IDLE_LOCK_TIMEOUT_KEY) return;
      setState((current) => setIdleLockTimeout(current, parseIdleLockTimeout(event.newValue)));
    }
    window.addEventListener(IDLE_LOCK_TIMEOUT_EVENT, onTimeoutChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(IDLE_LOCK_TIMEOUT_EVENT, onTimeoutChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled]);

  const applyTimeout = useCallback((minutes: IdleLockTimeoutMinutes) => {
    writeIdleLockTimeout(minutes);
    setState((current) => setIdleLockTimeout(current, minutes));
  }, []);

  const unlock = useCallback(() => {
    setState((current) => unlockIdleWorkspace(current, Date.now()));
  }, []);

  const lockNow = useCallback(() => {
    setState((current) => {
      if (current.phase === "locked") return current;
      clearCustomerDisplaySnapshot();
      return lockIdleWorkspace(current, Date.now());
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function onActivity() {
      const now = Date.now();
      if (now - lastActivityWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityWriteRef.current = now;
      setState((current) => recordIdleActivity(current, now));
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setState((current) => {
        const next = tickIdleLock(current, now);
        if (next !== current && next.phase === "locked") {
          clearCustomerDisplaySnapshot();
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return {
    locked: enabled && state.phase === "locked",
    timeoutMinutes: state.timeoutMinutes,
    setTimeoutMinutes: applyTimeout,
    lockNow,
    unlock,
  };
}
