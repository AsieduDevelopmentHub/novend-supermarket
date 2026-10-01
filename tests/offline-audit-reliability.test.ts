import { afterEach, describe, expect, it, vi } from "vitest";
import { claimOutboxRow } from "@/lib/offline/outbox";
import { recoverInterruptedSync } from "@/lib/offline/cleanup";
import { withOutboxSyncLock, SYNC_LEASE_MS } from "@/lib/offline/sync-lock";
import { markLocalSaleSynced } from "@/lib/offline/sales-repository";
import { markLocalReturnSynced } from "@/lib/offline/returns-repository";
import { createTransactionalOfflineDb } from "./helpers/transactional-offline-db";

afterEach(() => vi.useRealTimers());

const queued = (id = "op") => ({
  id,
  type: "complete_sale",
  clientOperationId: id,
  status: "pending",
  attempts: 0,
  payloadJson: "{}",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe("offline queue reliability", () => {
  it("allows only one concurrent claim", async () => {
    const { db, tables } = createTransactionalOfflineDb();
    await tables.outbox.put(queued());
    const claims = await Promise.all([
      claimOutboxRow(db, "op", "a"),
      claimOutboxRow(db, "op", "b"),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await tables.outbox.get("op"))?.attempts).toBe(1);
  });

  it("recovers expired claims while retaining recent active claims", async () => {
    const { db, tables } = createTransactionalOfflineDb();
    await tables.outbox.put({ ...queued("live"), status: "syncing" });
    await tables.outbox.put({
      ...queued("crashed"),
      status: "syncing",
      updatedAt: Date.now() - SYNC_LEASE_MS - 1,
    });
    expect(await recoverInterruptedSync(db)).toBe(1);
    expect((await tables.outbox.get("live"))?.status).toBe("syncing");
    expect((await tables.outbox.get("crashed"))?.status).toBe("pending");
  });

  it("excludes a second worker and releases ownership after failure", async () => {
    const { db } = createTransactionalOfflineDb();
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = withOutboxSyncLock(db, async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "first";
    });
    await started;
    expect(await withOutboxSyncLock(db, async () => "second")).toBeNull();
    release();
    expect(await first).toBe("first");
    await expect(
      withOutboxSyncLock(db, async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow("network");
    expect(await withOutboxSyncLock(db, async () => "next")).toBe("next");
  });

  it("acknowledges a sale together with its server ID and receipt", async () => {
    const { db, tables } = createTransactionalOfflineDb();
    await tables.outbox.put({ ...queued(), status: "syncing" });
    await tables.localSales.put({
      id: "sale",
      invoiceNumber: "INV-LOCAL",
      syncStatus: "pending",
    });
    await tables.localReceipts.put({
      id: "receipt",
      localSaleId: "sale",
      payloadJson: "{}",
    });
    await markLocalSaleSynced(
      "sale",
      { saleId: "server-sale", invoiceNumber: "INV-SERVER", receiptPayload: {} },
      { db, outboxId: "op" },
    );
    expect((await tables.localSales.get("sale"))?.serverSaleId).toBe("server-sale");
    expect((await tables.outbox.get("op"))?.status).toBe("synced");
    expect(
      JSON.parse(String((await tables.localReceipts.get("receipt"))?.payloadJson)).invoiceNumber,
    ).toBe("INV-LOCAL");
  });

  it("does not let an expired worker release its successor's lease", async () => {
    const { db } = createTransactionalOfflineDb();
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    let firstEntered!: () => void;
    let secondEntered!: () => void;
    const firstReady = new Promise<void>((resolve) => {
      firstEntered = resolve;
    });
    const secondReady = new Promise<void>((resolve) => {
      secondEntered = resolve;
    });
    try {
      const first = withOutboxSyncLock(db, async () => {
        firstEntered();
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      });
      await firstReady;
      clock.mockReturnValue(now + SYNC_LEASE_MS + 1);
      const second = withOutboxSyncLock(db, async () => {
        secondEntered();
        await new Promise<void>((resolve) => {
          releaseSecond = resolve;
        });
      });
      await secondReady;
      releaseFirst();
      await first;
      expect(await withOutboxSyncLock(db, async () => "third")).toBeNull();
      releaseSecond();
      await second;
    } finally {
      clock.mockRestore();
    }
  });

  it("rolls back sale reconciliation if queue acknowledgement fails", async () => {
    const { db, tables } = createTransactionalOfflineDb();
    await tables.outbox.put({ ...queued(), status: "syncing" });
    await tables.localSales.put({
      id: "sale",
      invoiceNumber: "INV-LOCAL",
      syncStatus: "pending",
    });
    await tables.localReceipts.put({
      id: "receipt",
      localSaleId: "sale",
      payloadJson: "{}",
    });
    tables.outbox.failNextPut = true;
    await expect(
      markLocalSaleSynced(
        "sale",
        { saleId: "server-sale", invoiceNumber: "INV-SERVER", receiptPayload: {} },
        { db, outboxId: "op" },
      ),
    ).rejects.toThrow("storage failure");
    expect((await tables.localSales.get("sale"))?.syncStatus).toBe("pending");
    expect((await tables.localReceipts.get("receipt"))?.payloadJson).toBe("{}");
    expect((await tables.outbox.get("op"))?.status).toBe("syncing");
  });

  it("rolls back return reconciliation if queue acknowledgement fails", async () => {
    const { db, tables } = createTransactionalOfflineDb();
    await tables.outbox.put({ ...queued(), status: "syncing" });
    await tables.localReturns.put({
      id: "return",
      returnNumber: "RET-LOCAL",
      syncStatus: "pending",
    });
    tables.outbox.failNextPut = true;
    await expect(
      markLocalReturnSynced(
        "return",
        { returnId: "server-return", returnNumber: "RET-SERVER", receiptPayload: {} },
        { db, outboxId: "op" },
      ),
    ).rejects.toThrow("storage failure");
    expect((await tables.localReturns.get("return"))?.syncStatus).toBe("pending");
    expect((await tables.outbox.get("op"))?.status).toBe("syncing");
  });

  it("does not acknowledge a missing local sale", async () => {
    const { db, tables } = createTransactionalOfflineDb();
    await tables.outbox.put({ ...queued(), status: "syncing" });
    await expect(
      markLocalSaleSynced(
        "missing",
        { saleId: "server", invoiceNumber: "INV", receiptPayload: {} },
        { db, outboxId: "op" },
      ),
    ).rejects.toThrow("Local sale missing");
    expect((await tables.outbox.get("op"))?.status).toBe("syncing");
  });
});
