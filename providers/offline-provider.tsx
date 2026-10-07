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
import { useAction, useConvex, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import { getOfflineDb, getBoundOrganizationId, isOfflineDbAvailable } from "@/lib/offline/db";
import {
  AUTO_SYNC_INTERVAL_MS,
  AUTO_SYNC_PENDING_THRESHOLD,
  OUTBOX_POLL_MS,
  getLastSnapshotAt,
} from "@/lib/offline/freshness";
import { countOutboxByStatus, listOpenOutbox } from "@/lib/offline/outbox";
import { pullOfflineSnapshot } from "@/lib/offline/snapshot";
import { loadCloudPolicy } from "@/lib/offline/cloud-policy";
import { drainOutbox } from "@/lib/offline/sync-engine";
import { maybeSendHeartbeat } from "@/lib/telemetry/heartbeat";
import { maybeRunScheduledCloudBackup } from "@/lib/offline/scheduled-backup";
import type { OfflineStatus } from "@/lib/offline/types";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { toUserMessage } from "@/lib/errors";
import { PLATFORM_OFFLINE_ORG_ID } from "@/lib/offline/platform-cache";
import { holdDatabaseForUpdate } from "@/lib/offline/update-barrier";

function isPlatformReplicaBound() {
  return getBoundOrganizationId() === PLATFORM_OFFLINE_ORG_ID;
}

type OfflineContextValue = OfflineStatus & {
  refreshStatus: () => Promise<void>;
  pullSnapshot: (options?: { force?: boolean }) => Promise<void>;
  flushOutbox: (options?: { force?: boolean; showProgress?: boolean }) => Promise<void>;
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
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const completeSale = useMutation(api.sales.completeSale);
  const processReturn = useMutation(api.returns.processReturn);
  const openDiningSession = useMutation(api.dining.openSession);
  const addDiningSessionItem = useMutation(api.dining.addSessionItem);
  const fireKitchenTicket = useMutation(api.dining.fireKitchenTicket);
  const payDiningSession = useMutation(api.dining.paySession);
  const createHotelReservation = useMutation(api.hotel.createReservation);
  const hotelCheckIn = useMutation(api.hotel.checkIn);
  const addHotelFolioCharge = useMutation(api.hotel.addFolioCharge);
  const hotelCheckoutPay = useMutation(api.hotel.checkoutPay);
  const createSupplier = useMutation(api.suppliers.create);
  const updateSupplier = useMutation(api.suppliers.update);
  const recordPurchase = useMutation(api.wholesale.recordPurchase);
  const recordSupplierPayment = useMutation(api.suppliers.recordPayment);
  const transferToBranch = useMutation(api.wholesale.transferToBranch);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const updateLotExpiry = useMutation(api.inventory.updateLotExpiry);
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
  const claimStorageUpload = useMutation(api.storageUploads.claim);
  const createBranch = useMutation(api.branches.create);
  const updateBranch = useMutation(api.branches.update);
  const upsertStaffCompensation = useMutation(api.payroll.upsertCompensation);
  const paySalary = useMutation(api.payroll.paySalary);
  const payCommission = useMutation(api.payroll.payCommission);
  const recordHeartbeat = useMutation(api.telemetry.recordHeartbeat);
  const generateBackupUploadUrl = useMutation(api.cloudBackups.generateBackupUploadUrl);
  const claimBackupUpload = useMutation(api.storageUploads.claimBackup);
  const recordBackup = useMutation(api.cloudBackups.recordBackup);
  const [status, setStatus] = useState<OfflineStatus>(emptyStatus);
  const [syncCenterOpen, setSyncCenterOpen] = useState(false);
  const pullingRef = useRef(false);
  const [preparingUpdate, setPreparingUpdate] = useState(false);

  useEffect(() => {
    const bridge = window.novendDesktop;
    if (!bridge?.onPrepareUpdate || !bridge.acknowledgeUpdatePreparation) return;
    const acknowledge = bridge.acknowledgeUpdatePreparation;
    let active: { id: string; controller: AbortController } | null = null;
    const preventInput = (event: Event) => {
      if (!active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const inputEvents = ["keydown", "pointerdown", "click", "submit"];
    for (const name of inputEvents) window.addEventListener(name, preventInput, true);
    const unsubscribe = bridge.onPrepareUpdate(({ id }) => {
      if (active) {
        void acknowledge(id, false);
        return;
      }
      const controller = new AbortController();
      active = { id, controller };
      setPreparingUpdate(true);
      void (async () => {
        try {
          const db = await getOfflineDb();
          if (!db || controller.signal.aborted) {
            await acknowledge(id, false);
            return;
          }
          await holdDatabaseForUpdate(db, controller.signal, () => acknowledge(id, true));
        } catch {
          await acknowledge(id, false).catch(() => undefined);
        } finally {
          if (active?.id === id) active = null;
          if (!controller.signal.aborted) setPreparingUpdate(false);
        }
      })();
    });
    const cancel = bridge.onCancelUpdatePreparation?.(({ id }) => {
      if (active?.id !== id) return;
      active.controller.abort();
      active = null;
      setPreparingUpdate(false);
    });
    return () => {
      unsubscribe();
      cancel?.();
      active?.controller.abort();
      active = null;
      for (const name of inputEvents) window.removeEventListener(name, preventInput, true);
    };
  }, []);

  const openSyncCenter = useCallback(() => setSyncCenterOpen(true), []);
  const closeSyncCenter = useCallback(() => setSyncCenterOpen(false), []);

  const refreshStatus = useCallback(async () => {
    const db = await getOfflineDb();
    const counts = await countOutboxByStatus();
    const open = await listOpenOutbox();
    const failedError =
      open.find(
        (row) =>
          (row.status === "failed" || row.status === "blocked_by_entitlement") && row.lastError,
      )?.lastError ?? null;
    setStatus((prev) => ({
      ...prev,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      dexieAvailable: Boolean(db) || isOfflineDbAvailable(),
      pendingCount: counts.pending + counts.syncing,
      failedCount: counts.failed + counts.blocked,
      lastError: failedError,
    }));
  }, []);

  const pullSnapshot = useCallback(
    async (options?: { force?: boolean }) => {
      if (!navigator.onLine) return;
      // Offline shell has no Convex JWT — pulls would only burn auth errors.
      if (!isAuthenticated) return;
      // Super Admin platform replica has no tenant org — offline.getSnapshot
      // would throw Forbidden and can surface as the app error boundary.
      if (isPlatformReplicaBound()) return;
      // Snapshot pull is the subscription-like mirror path; skip it entirely
      // when the tenant's cloud mode does not use realtime mirroring.
      if (!(await loadCloudPolicy()).shouldUseRealtimeSubscriptions()) return;
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
    [convex, isAuthenticated, refreshStatus],
  );

  const flushOutbox = useCallback(
    async (options?: { force?: boolean; showProgress?: boolean }) => {
      if (!navigator.onLine) return;
      // Offline login unlocks the till without a Convex JWT — do not attempt
      // uploads until the user signs in online (otherwise restocks pile into
      // "Needs a fix" after empty auth failures).
      if (!isAuthenticated) {
        setStatus((prev) => ({
          ...prev,
          lastError: options?.force
            ? "Sign in online to upload queued changes from this device."
            : prev.lastError,
          syncing: false,
        }));
        return;
      }
      if (isPlatformReplicaBound()) return;
      // Outbox flush only runs when the tenant's cloud mode queues realtime
      // sync. Sync Center force still routes here, so the policy always applies.
      if (!(await loadCloudPolicy()).shouldQueueRealtimeSync()) return;

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
        syncing: false,
      }));
      try {
        const result = await drainOutbox({
          force: options?.force === true,
          onStart:
            options?.showProgress === true
              ? () => {
                  setStatus((prev) => ({ ...prev, syncing: true }));
                }
              : undefined,
          mutators: {
            completeSale: (args) => completeSale(args),
            processReturn: (args) => processReturn(args),
            openDiningSession: (args) => openDiningSession(args),
            addDiningSessionItem: (args) => addDiningSessionItem(args),
            fireKitchenTicket: (args) => fireKitchenTicket(args),
            payDiningSession: (args) => payDiningSession(args),
            createHotelReservation: (args) => createHotelReservation(args),
            hotelCheckIn: (args) => hotelCheckIn(args),
            addHotelFolioCharge: (args) => addHotelFolioCharge(args),
            hotelCheckoutPay: (args) => hotelCheckoutPay(args),
            createSupplier: (args) => createSupplier(args),
            updateSupplier: (args) => updateSupplier(args),
            recordPurchase: (payload) =>
              recordPurchase({
                supplierId: payload.supplierId as never,
                invoiceNumber: payload.invoiceNumber,
                purchasedAt: payload.purchasedAt,
                notes: payload.notes,
                amountPaid: payload.amountPaid,
                paymentMethod: payload.paymentMethod,
                clientOperationId: payload.clientOperationId,
                items: payload.items.map((item) => ({
                  productId: item.productId as never,
                  quantity: item.quantity,
                  unitCost: item.unitCost,
                  sellingPrice: item.sellingPrice,
                  expiryDate: item.expiryDate,
                })),
              }),
            recordSupplierPayment: (args) => recordSupplierPayment(args),
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
            updateLotExpiry: (payload) =>
              updateLotExpiry({
                lotId: payload.lotId as never,
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
            claimStorageUpload: (args) => claimStorageUpload(args),
            createProduct: (args) => createProduct(args),
            updateProduct: (args) => updateProduct(args),
            createBranch: (args) => createBranch(args),
            updateBranch: (args) => updateBranch(args),
            upsertStaffCompensation: (args) =>
              upsertStaffCompensation({
                profileId: args.profileId as never,
                salaryAmount: args.salaryAmount,
                salaryFrequency: args.salaryFrequency,
                commissionRate: args.commissionRate,
                commissionBasis: args.commissionBasis,
              }),
            paySalary: (args) =>
              paySalary({
                profileId: args.profileId as never,
                payPeriodKey: args.payPeriodKey,
                clientOperationId: args.clientOperationId,
              }),
            payCommission: (args) =>
              payCommission({
                profileId: args.profileId as never,
                payPeriodKey: args.payPeriodKey,
                clientOperationId: args.clientOperationId,
              }),
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
      openDiningSession,
      addDiningSessionItem,
      fireKitchenTicket,
      payDiningSession,
      createHotelReservation,
      hotelCheckIn,
      addHotelFolioCharge,
      hotelCheckoutPay,
      createSupplier,
      updateSupplier,
      recordPurchase,
      recordSupplierPayment,
      transferToBranch,
      adjustStock,
      updateLotExpiry,
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
      claimStorageUpload,
      createBranch,
      updateBranch,
      upsertStaffCompensation,
      paySalary,
      payCommission,
      convex,
      isAuthenticated,
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
          await pullSnapshot();
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
      // Reconnect flaps are common on Electron/Capacitor. Respect the snapshot
      // TTL so each online event does not re-run the 27-table full snapshot.
      void pullSnapshot().then(() => flushOutbox());
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

  // Platform telemetry heartbeat. Intentionally NOT gated by the cloud policy:
  // it must run even in local_only (business sync off, heartbeat on) so Novend
  // can license, manage, and monitor the organization. Self-throttled to at most
  // one write per 24h unless a meaningful field changes. Skipped on the Super
  // Admin platform replica (no tenant licence / org session).
  useEffect(() => {
    if (!online) return;
    if (isPlatformReplicaBound()) return;
    const send = () => void maybeSendHeartbeat((args) => recordHeartbeat(args));
    send();
    const onOnline = () => send();
    const onFocus = () => {
      if (typeof navigator === "undefined" || navigator.onLine) send();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [online, recordHeartbeat]);

  // Automatic cloud uploads for backup_only / snapshot_only. Delayed after shell
  // load so Cap WebViews are not frozen by export+PBKDF2 during first paint.
  // Hourly timer only checks local state; Convex is contacted when due.
  useEffect(() => {
    if (!online) return;
    if (isPlatformReplicaBound()) return;
    const run = () =>
      void maybeRunScheduledCloudBackup({
        generateBackupUploadUrl: () => generateBackupUploadUrl({}),
        claimBackup: (args) => claimBackupUpload(args),
        recordBackup: (args) => recordBackup(args),
      });
    // ~3 minutes after mount — POS must be usable before background packaging.
    const initialDelayMs = 3 * 60 * 1000;
    const initialId = window.setTimeout(run, initialDelayMs);
    const id = window.setInterval(run, 60 * 60 * 1000);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(id);
    };
  }, [online, generateBackupUploadUrl, claimBackupUpload, recordBackup]);

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

  return (
    <OfflineContext.Provider value={value}>
      {children}
      {preparingUpdate ? (
        <div
          className="bg-background/95 fixed inset-0 z-[9999] grid place-items-center p-6"
          role="status"
          aria-live="polite"
        >
          <p className="text-foreground text-center">Securing local records before restarting…</p>
        </div>
      ) : null}
    </OfflineContext.Provider>
  );
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
