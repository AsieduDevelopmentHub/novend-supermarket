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
import { useAction, useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import { getOfflineDb, isOfflineDbAvailable } from "@/lib/offline/db";
import {
  AUTO_SYNC_INTERVAL_MS,
  AUTO_SYNC_PENDING_THRESHOLD,
  OUTBOX_POLL_MS,
  getLastSnapshotAt,
} from "@/lib/offline/freshness";
import { countOutboxByStatus, listOpenOutbox } from "@/lib/offline/outbox";
import { pullOfflineSnapshot } from "@/lib/offline/snapshot";
import { drainOutbox } from "@/lib/offline/sync-engine";
import type { OfflineStatus } from "@/lib/offline/types";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { toUserMessage } from "@/lib/errors";

type OfflineContextValue = OfflineStatus & {
  refreshStatus: () => Promise<void>;
  pullSnapshot: (options?: { force?: boolean }) => Promise<void>;
  flushOutbox: (options?: { force?: boolean }) => Promise<void>;
  /** Force catalog mirror refresh + bump lastSyncAt so sales UI reloads. */
  refreshCatalog: () => Promise<void>;
  syncCenterOpen: boolean;
  openSyncCenter: () => void;
  closeSyncCenter: () => void;
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
  const createSupplier = useMutation(api.suppliers.create);
  const updateSupplier = useMutation(api.suppliers.update);
  const recordPurchase = useMutation(api.wholesale.recordPurchase);
  const transferToBranch = useMutation(api.wholesale.transferToBranch);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const transferStock = useMutation(api.inventory.transferStock);
  const createCustomer = useMutation(api.customers.create);
  const updateCustomer = useMutation(api.customers.update);
  const createExpense = useMutation(api.analytics.createExpense);
  const removeExpense = useMutation(api.analytics.removeExpense);
  const updateOwnProfile = useMutation(api.users.updateOwnProfile);
  const createUserAccount = useAction(api.users.createUserAccount);
  const createCategory = useMutation(api.categories.create);
  const createProduct = useMutation(api.products.createProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);
  const createBranch = useMutation(api.branches.create);
  const updateBranch = useMutation(api.branches.update);
  const [status, setStatus] = useState<OfflineStatus>(emptyStatus);
  const [syncCenterOpen, setSyncCenterOpen] = useState(false);
  const pullingRef = useRef(false);

  const openSyncCenter = useCallback(() => setSyncCenterOpen(true), []);
  const closeSyncCenter = useCallback(() => setSyncCenterOpen(false), []);

  const refreshStatus = useCallback(async () => {
    const db = await getOfflineDb();
    const counts = await countOutboxByStatus();
    const open = await listOpenOutbox();
    const queuedError = open.find((row) => row.lastError)?.lastError ?? null;
    setStatus((prev) => ({
      ...prev,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      dexieAvailable: Boolean(db) || isOfflineDbAvailable(),
      pendingCount: counts.pending + counts.syncing,
      failedCount: counts.failed,
      lastError: queuedError,
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

  const flushOutbox = useCallback(
    async (options?: { force?: boolean }) => {
      if (!navigator.onLine) return;

      const counts = await countOutboxByStatus();
      const work = counts.pending + counts.syncing;
      if (!options?.force && work === 0 && counts.failed === 0) {
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
        pendingCount: work + (options?.force ? counts.failed : 0),
        failedCount: options?.force ? 0 : counts.failed,
        syncing: work > 0 || (options?.force === true && counts.failed > 0),
      }));
      try {
        const result = await drainOutbox({
          force: options?.force === true,
          mutators: {
            completeSale: (args) => completeSale(args),
            processReturn: (args) => processReturn(args),
            createSupplier: (args) => createSupplier(args),
            updateSupplier: (args) => updateSupplier(args),
            recordPurchase: (payload) =>
              recordPurchase({
                supplierId: payload.supplierId as never,
                invoiceNumber: payload.invoiceNumber,
                purchasedAt: payload.purchasedAt,
                notes: payload.notes,
                clientOperationId: payload.clientOperationId,
                items: payload.items.map((item) => ({
                  productId: item.productId as never,
                  quantity: item.quantity,
                  unitCost: item.unitCost,
                  expiryDate: item.expiryDate,
                })),
              }),
            transferToBranch: (args) =>
              transferToBranch({
                productId: args.productId,
                branchId: args.branchId,
                quantity: args.quantity,
                clientOperationId: args.clientOperationId,
              }),
            adjustStock: (payload) =>
              adjustStock({
                productId: payload.productId as never,
                branchId: payload.branchId as never,
                quantityChange: payload.quantityChange,
                reason: payload.reason,
                note: payload.note,
                expiryDate: payload.expiryDate,
                clientOperationId: payload.clientOperationId,
              }),
            transferStock: (payload) =>
              transferStock({
                productId: payload.productId as never,
                fromBranchId: payload.fromBranchId as never,
                toBranchId: payload.toBranchId as never,
                quantity: payload.quantity,
                note: payload.note,
                clientOperationId: payload.clientOperationId,
              }),
            createCustomer: (args) => createCustomer(args),
            updateCustomer: (args) => updateCustomer(args),
            createExpense: (payload) =>
              createExpense({
                amount: payload.amount,
                category: payload.category as never,
                occurredAt: payload.occurredAt,
                description: payload.description,
                branchId: payload.branchId as never,
                clientOperationId: payload.clientOperationId,
              }),
            removeExpense: (args) => removeExpense(args),
            updateOwnProfile: (args) =>
              updateOwnProfile({
                name: args.name,
                phone: args.phone,
              }),
            createUserAccount: (args) =>
              createUserAccount({
                email: args.email,
                password: args.password,
                name: args.name,
                role: args.role,
                branchId: args.branchId,
                phone: args.phone,
              }),
            createCategory: (args) => createCategory({ name: args.name }),
            generateUploadUrl: () => generateUploadUrl({}),
            createProduct: (args) => createProduct(args),
            updateProduct: (args) => updateProduct(args),
            createBranch: (args) => createBranch(args),
            updateBranch: (args) => updateBranch(args),
          },
          convex: { query: convex.query.bind(convex) },
        });
        if (!result.skipped) {
          setStatus((prev) => ({
            ...prev,
            lastSyncAt: Date.now(),
            lastError: result.failed > 0 ? prev.lastError : null,
          }));
        }
      } catch (error) {
        setStatus((prev) => ({
          ...prev,
          lastError: toUserMessage(error, "Sync failed"),
        }));
      } finally {
        setStatus((prev) => ({ ...prev, syncing: false }));
        await refreshStatus();
      }
    },
    [
      completeSale,
      processReturn,
      createSupplier,
      updateSupplier,
      recordPurchase,
      transferToBranch,
      adjustStock,
      transferStock,
      createCustomer,
      updateCustomer,
      createExpense,
      removeExpense,
      updateOwnProfile,
      createUserAccount,
      createCategory,
      createProduct,
      updateProduct,
      generateUploadUrl,
      createBranch,
      updateBranch,
      convex,
      refreshStatus,
    ],
  );

  const refreshCatalog = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus((prev) => ({ ...prev, lastSyncAt: Date.now() }));
      return;
    }
    await pullSnapshot({ force: true });
  }, [pullSnapshot]);

  useEffect(() => {
    return subscribeReplicaChanged((detail) => {
      setStatus((prev) => ({ ...prev, lastSyncAt: Date.now() }));
      if (detail.pull) void pullSnapshot({ force: true });
      if (detail.flush) void flushOutbox();
      void refreshStatus();
    });
  }, [pullSnapshot, flushOutbox, refreshStatus]);

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
    // First session pull must be forced when this replica has no snapshot yet
    // (post-login org bind) — TTL skip on a warm anon DB left KPIs at zero.
    void (async () => {
      const lastSnap = await getLastSnapshotAt();
      await pullSnapshot({ force: !lastSnap });
      await flushOutbox();
    })();
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
      syncCenterOpen,
      openSyncCenter,
      closeSyncCenter,
    }),
    [
      status,
      online,
      refreshStatus,
      pullSnapshot,
      flushOutbox,
      refreshCatalog,
      syncCenterOpen,
      openSyncCenter,
      closeSyncCenter,
    ],
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
      syncCenterOpen: false,
      openSyncCenter: () => undefined,
      closeSyncCenter: () => undefined,
    } satisfies OfflineContextValue;
  }
  return ctx;
}
