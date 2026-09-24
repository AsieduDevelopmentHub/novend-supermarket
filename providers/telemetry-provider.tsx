"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { APP_VERSION } from "@/constants/app";
import { describeClientDevice, telemetryRuntimeForDevice } from "@/lib/device";
import { useConnectivity } from "@/hooks/use-connectivity";
import { countOutboxByStatus } from "@/lib/offline/outbox";

const QUEUE_KEY = "novend.telemetry.queue.v1";
const MAX_QUEUED_EVENTS = 200;

export type ClientTelemetryEvent = {
  kind: "feature_used" | "workflow_completed" | "client_error" | "sync_health";
  feature?: string;
  action?: string;
  runtime: "web" | "pwa" | "electron" | "android" | "ios";
  appVersion?: string;
  errorCode?: string;
  count?: number;
  occurredAt?: number;
};

const FEATURE_BY_ROOT: Record<string, string> = {
  dashboard: "dashboard",
  sales: "sales",
  products: "products",
  inventory: "inventory",
  reports: "reports",
  users: "users",
  settings: "settings",
  platform: "platform",
};

function readQueue(): ClientTelemetryEvent[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || "[]") as unknown;
    return Array.isArray(value) ? (value as ClientTelemetryEvent[]).slice(-MAX_QUEUED_EVENTS) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: ClientTelemetryEvent[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUED_EVENTS)));
  } catch {
    // Telemetry must never interfere with POS workflows.
  }
}

export function queueTelemetryEvent(event: ClientTelemetryEvent) {
  if (typeof window === "undefined") return;
  writeQueue([...readQueue(), { ...event, occurredAt: event.occurredAt ?? Date.now() }]);
  window.dispatchEvent(new Event("novend-telemetry-queued"));
}

/** Flushes privacy-limited usage events without delaying application work. */
export function TelemetryProvider({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const online = useConnectivity();
  const recordBatch = useMutation(api.telemetry.recordBatch);
  const flushing = useRef(false);
  const identityRef = useRef<Awaited<ReturnType<typeof describeClientDevice>> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void describeClientDevice().then((identity) => {
      identityRef.current = identity;
      const root = pathname.split("/").filter(Boolean)[0] ?? "";
      const feature = FEATURE_BY_ROOT[root];
      if (!feature) return;
      queueTelemetryEvent({
        kind: "feature_used",
        feature,
        action: "opened",
        runtime: telemetryRuntimeForDevice(identity),
        appVersion: identity.appVersion ?? APP_VERSION,
      });
    });
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;
    /** Allowlisted fingerprint only — never message, stack, or URLs. */
    const sanitizeErrorCode = (kind: string, name: string | undefined) => {
      const safeName = (name ?? "Unknown")
        .replace(/[^a-zA-Z0-9_.-]/g, "")
        .slice(0, 48);
      return `${kind}.${safeName || "Unknown"}`.slice(0, 64);
    };
    const reportError = (errorCode: string) => {
      const identity = identityRef.current;
      if (!identity) return;
      const root = pathname.split("/").filter(Boolean)[0] ?? "";
      queueTelemetryEvent({
        kind: "client_error",
        feature: FEATURE_BY_ROOT[root],
        runtime: telemetryRuntimeForDevice(identity),
        appVersion: identity.appVersion ?? APP_VERSION,
        errorCode,
      });
    };
    const onError = (event: ErrorEvent) => {
      const name = event.error instanceof Error ? event.error.name : event.error?.constructor?.name;
      reportError(sanitizeErrorCode("window_error", typeof name === "string" ? name : "Error"));
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const name =
        reason instanceof Error
          ? reason.name
          : reason && typeof reason === "object" && "name" in reason
            ? String((reason as { name: unknown }).name)
            : "Rejection";
      reportError(sanitizeErrorCode("unhandled_rejection", name));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function reportSyncHealth() {
      const identity = identityRef.current;
      if (!identity) return;
      const counts = await countOutboxByStatus();
      if (cancelled) return;
      const runtime = telemetryRuntimeForDevice(identity);
      if (counts.pending > 0) {
        queueTelemetryEvent({
          kind: "sync_health",
          feature: "sync",
          action: "pending",
          runtime,
          appVersion: identity.appVersion ?? APP_VERSION,
          count: counts.pending,
        });
      }
      if (counts.failed > 0) {
        queueTelemetryEvent({
          kind: "sync_health",
          feature: "sync",
          action: "failed",
          runtime,
          appVersion: identity.appVersion ?? APP_VERSION,
          count: counts.failed,
        });
      }
    }
    void reportSyncHealth();
    const interval = window.setInterval(() => void reportSyncHealth(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !online) return;
    let cancelled = false;

    async function flush() {
      if (cancelled || flushing.current) return;
      const queued = readQueue();
      if (queued.length === 0) return;
      flushing.current = true;
      const batch = queued.slice(0, 40);
      try {
        await recordBatch({ events: batch });
        if (!cancelled) writeQueue(readQueue().slice(batch.length));
      } catch {
        // Keep the batch for the next online/authenticated opportunity.
      } finally {
        flushing.current = false;
      }
    }

    void flush();
    const onQueued = () => void flush();
    window.addEventListener("novend-telemetry-queued", onQueued);
    const interval = window.setInterval(() => void flush(), 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener("novend-telemetry-queued", onQueued);
      window.clearInterval(interval);
    };
  }, [enabled, online, recordBatch]);

  return null;
}
