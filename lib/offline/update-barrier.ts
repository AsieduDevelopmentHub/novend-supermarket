import Dexie from "dexie";
import type { NovendOfflineDb } from "./db";

/**
 * Wait behind existing writes, then hold every replica store until restart.
 * The native acknowledgement is sent only while the IDB write lock is held.
 * Cancellation or a failed restart releases the lock after at most 15 seconds.
 */
export async function holdDatabaseForUpdate(
  db: NovendOfflineDb,
  signal: AbortSignal,
  acknowledge: () => Promise<boolean>,
): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    if (signal.aborted) return;
    await Dexie.waitFor(
      new Promise<void>((resolve, reject) => {
        const finish = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, 15_000);
        signal.addEventListener("abort", finish, { once: true });
        void acknowledge()
          .then((accepted) => {
            if (!accepted) finish();
          })
          .catch((error: unknown) => {
            clearTimeout(timer);
            signal.removeEventListener("abort", finish);
            reject(error);
          });
      }),
    );
  });
}
