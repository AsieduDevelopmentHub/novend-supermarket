import { describe, expect, it, vi } from "vitest";
import { holdDatabaseForUpdate } from "@/lib/offline/update-barrier";
import { createTransactionalOfflineDb } from "./helpers/transactional-offline-db";

vi.mock("dexie", () => ({ default: { waitFor: (promise: Promise<unknown>) => promise } }));

describe("desktop database write barrier", () => {
  it("waits for prior writes and blocks later writes until cancelled", async () => {
    const { db, tables } = createTransactionalOfflineDb();
    let finishWrite!: () => void;
    const writing = db.transaction("rw", db.localSales, async () => {
      await new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
      await tables.localSales.put({ id: "sale", syncStatus: "pending" });
    });
    const controller = new AbortController();
    let ready!: () => void;
    const prepared = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const acknowledge = vi.fn(async () => {
      ready();
      return true;
    });
    const barrier = holdDatabaseForUpdate(db, controller.signal, acknowledge);
    await Promise.resolve();
    expect(acknowledge).not.toHaveBeenCalled();
    finishWrite();
    await writing;
    await prepared;
    expect((await tables.localSales.get("sale"))?.syncStatus).toBe("pending");
    let laterCommitted = false;
    const later = db.transaction("rw", db.localSales, async () => {
      laterCommitted = true;
    });
    await Promise.resolve();
    expect(laterCommitted).toBe(false);
    controller.abort();
    await barrier;
    await later;
    expect(laterCommitted).toBe(true);
  });
});
