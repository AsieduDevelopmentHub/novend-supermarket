"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import { getOfflineDb, isOfflineDbAvailable } from "@/lib/offline/db";
import {
  AUTO_SYNC_INTERVAL_MS,
  AUTO_SYNC_PENDING_THRESHOLD,
  OUTBOX_POLL_MS,
  getLastSnapshotAt,
} from "@/lib/offline/freshness";
import { countOutboxByStatus } from "@/lib/offline/outbox";
import { pullOfflineSnapshot } from "@/lib/offline/snapshot";
import { drainOutbox } from "@/lib/offline/sync-engine";
import type { OfflineStatus } from "@/lib/offline/types";
import { toUserMessage } from "@/lib/errors";

type OfflineContextValue = OfflineStatus & {
  refreshStatus: () => Promise<void>;
  pullSnapshot: (options?: { force?: boolean }) => Promise<void>;
  flushOutbox: () => Promise<void>;
  /** Force catalog mirror refresh + bump lastSyncAt so sales UI reloads. */
  refreshCatalog: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

const emptyStatus: OfflineStatus = {
  online: true,
  dexieAvailable: false,
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: null,
  lastError: null,
  syncing: false,
};

export function OfflineProvider({ children }: { children: ReactNode }) {
  const online = useConnectivity();
  const convex = useConvex();
  const completeSale = useMutation(api.sales.completeSale);
  const processReturn = useMutation(api.returns.processReturn);
  const [status, setStatus] = useState<OfflineStatus>(emptyStatus);
  const pullingRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    const db = await getOfflineDb();
    const counts = await countOutboxByStatus();
    setStatus((prev) => ({
      ...prev,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      dexieAvailable: Boolean(db) || isOfflineDbAvailable(),
      pendingCount: counts.pending + counts.syncing,
      failedCount: counts.failed,
    }));
  }, []);

  const pullSnapshot = useCallback(
    async (options?: { force?: boolean }) => {
      if (!navigator.onLine) return;
      if (pullingRef.current) return;
      pullingRef.current = true;
      try {
        const result = await pullOfflineSnapshot(
          { query: convex.query.bind(convex) },
          { force: options?.force === true },
        );
        if (result && !result.skipped) {
          setStatus((prev) => ({
            ...prev,
            lastSyncAt: Date.now(),
            dexieAvailable: true,
          }));
        } else if (result?.skipped) {
          setStatus((prev) => ({
            ...prev,
            dexieAvailable: true,
            lastSyncAt: prev.lastSyncAt ?? Date.now(),
          }));
        }
      } catch {
        // Snapshot refresh is best-effort background work. Do not surface as a
        // shell conflict — that caused a top-of-page flicker during HMR / boot.
      } finally {
        pullingRef.current = false;
      }
      await refreshStatus();
    },
    [convex, refreshStatus],
  );

  const flushOutbox = useCallback(async () => {
    if (!navigator.onLine) return;

    const counts = await countOutboxByStatus();
    const work = counts.pending + counts.syncing;
    if (work === 0 && counts.failed === 0) {
      setStatus((prev) => ({
        ...prev,
        pendingCount: 0,
        failedCount: 0,
        syncing: false,
      }));
      return;
    }

    setStatus((prev) => ({
      ...prev,
      pendingCount: work,
      failedCount: counts.failed,
      syncing: work > 0,
    }));
    try {
      await drainOutbox({
        completeSale: (args) => completeSale(args),
        processReturn: (args) => processReturn(args),
        convex: { query: convex.query.bind(convex) },
      });
      setStatus((prev) => ({ ...prev, lastSyncAt: Date.now(), lastError: null }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        lastError: toUserMessage(error, "Sync failed"),
      }));
    } finally {
      setStatus((prev) => ({ ...prev, syncing: false }));
      await refreshStatus();
    }
  }, [completeSale, processReturn, convex, refreshStatus]);

  const refreshCatalog = useCallback(async () => {
    if (!navigator.onLine) return;
    await pullSnapshot({ force: true });
  }, [pullSnapshot]);

  useEffect(() => {
    void (async () => {
      await getOfflineDb();
      await refreshStatus();
    })();
  }, [refreshStatus]);

  useEffect(() => {
    if (!online) {
      void refreshStatus();
      return;
    }
    // Reconnect / online boot: refresh Dexie replica (TTL-gated) then drain outbox.
    void pullSnapshot().then(() => flushOutbox());
  }, [online, pullSnapshot, flushOutbox, refreshStatus]);

  useEffect(() => {
    if (!online) return;
    const id = window.setInterval(() => {
      void (async () => {
        const counts = await countOutboxByStatus();
        const pendingWork = counts.pending + counts.syncing;
        const lastSnap = await getLastSnapshotAt();
        const dueByTime = !lastSnap || Date.now() - lastSnap >= AUTO_SYNC_INTERVAL_MS;
        const dueByEvents = pendingWork >= AUTO_SYNC_PENDING_THRESHOLD || counts.failed > 0;

        if (dueByTime) {
          await pullSnapshot({ force: true });
          await flushOutbox();
          return;
        }
        if (dueByEvents) {
          await flushOutbox();
        }
      })();
    }, OUTBOX_POLL_MS);
    return () => window.clearInterval(id);
  }, [online, flushOutbox, pullSnapshot]);

  useEffect(() => {
    const onOnline = () => {
      void pullSnapshot({ force: true }).then(() => flushOutbox());
    };
    const onFocus = () => {
      if (!navigator.onLine) return;
      void (async () => {
        const counts = await countOutboxByStatus();
        const pendingWork = counts.pending + counts.syncing;
        if (pendingWork >= AUTO_SYNC_PENDING_THRESHOLD || counts.failed > 0) {
          await flushOutbox();
        }
      })();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [pullSnapshot, flushOutbox]);

  const value = useMemo<OfflineContextValue>(
    () => ({
      ...status,
      online,
      refreshStatus,
      pullSnapshot,
      flushOutbox,
      refreshCatalog,
    }),
    [status, online, refreshStatus, pullSnapshot, flushOutbox, refreshCatalog],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineStatus() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    return {
      ...emptyStatus,
      refreshStatus: async () => undefined,
      pullSnapshot: async () => undefined,
      flushOutbox: async () => undefined,
      refreshCatalog: async () => undefined,
    } satisfies OfflineContextValue;
  }
  return ctx;
}
