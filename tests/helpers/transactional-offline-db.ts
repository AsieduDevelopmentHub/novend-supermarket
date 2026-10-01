import type { NovendOfflineDb } from "@/lib/offline/db";

type Row = Record<string, unknown>;
class MemoryTable {
  rows = new Map<string, Row>();
  failNextPut = false;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async get(id: string) {
    return structuredClone(this.rows.get(id));
  }

  async put(row: Row) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error("Simulated storage failure");
    }
    this.rows.set(String(row[this.name === "meta" ? "key" : "id"]), structuredClone(row));
  }

  async delete(id: string) {
    this.rows.delete(id);
  }

  async toArray() {
    return structuredClone([...this.rows.values()]);
  }

  async bulkPut(rows: Row[]) {
    for (const row of rows) await this.put(row);
  }

  where(field: string) {
    return {
      equals: (value: unknown) => {
        let predicate = (row: Row) => row[field] === value;
        const collection = {
          filter: (next: (row: Row) => boolean) => {
            const previous = predicate;
            predicate = (row: Row) => previous(row) && next(row);
            return collection;
          },
          toArray: async () => (await this.toArray()).filter(predicate),
          first: async () => (await this.toArray()).find(predicate),
          modify: async (changes: Row) => {
            for (const row of await this.toArray()) {
              if (predicate(row)) await this.put({ ...row, ...changes });
            }
          },
        };
        return collection;
      },
    };
  }
}

/** Serial transactions with rollback for fault-injection tests, not an IDB emulator. */
export function createTransactionalOfflineDb() {
  const tableNames = ["meta", "outbox", "localSales", "localReceipts", "localReturns"];
  const tables = Object.fromEntries(tableNames.map((name) => [name, new MemoryTable(name)]));
  let tail = Promise.resolve();
  const db = {
    ...tables,
    name: "audit-test",
    tables: Object.values(tables),
    transaction: async (
      _mode: string,
      scope: MemoryTable | MemoryTable[],
      work: () => Promise<unknown>,
    ) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const selected = Array.isArray(scope) ? scope : [scope];
      const snapshots = selected.map((table) => [table, structuredClone(table.rows)] as const);
      try {
        return await work();
      } catch (error) {
        for (const [table, rows] of snapshots) table.rows = rows;
        throw error;
      } finally {
        release();
      }
    },
  };
  return { db: db as unknown as NovendOfflineDb, tables };
}
