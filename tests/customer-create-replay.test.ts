import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rememberClientOp, replayClientOp } from "@/convex/shared/clientOps";

type Row = Record<string, unknown>;

function testContext() {
  const rows: Record<string, Row[]> = { customers: [], mutationClientOps: [] };
  const db = {
    insert: async (table: string, value: Row) => {
      const id = `${table}-${rows[table].length + 1}`;
      rows[table].push({ ...value, _id: id });
      return id;
    },
    query: (table: string) => ({
      withIndex: (_index: string, configure: (query: unknown) => void) => {
        const constraints: Array<[string, unknown]> = [];
        const query = {
          eq: (key: string, value: unknown) => {
            constraints.push([key, value]);
            return query;
          },
        };
        configure(query);
        return {
          unique: async () =>
            rows[table].find((row) =>
              constraints.every(([key, value]) => row[key] === value),
            ) ?? null,
        };
      },
    }),
  };
  return { ctx: { db } as never, rows };
}

describe("customer creation replay", () => {
  it("returns the original customer after an ambiguous response and retry", async () => {
    const { ctx, rows } = testContext();
    await rememberClientOp(ctx, {
      organizationId: "org-a" as never,
      clientOperationId: "device-create-1",
      kind: "create_customer",
      result: "customer-1",
    });
    expect(
      await replayClientOp<string>(ctx, "org-a" as never, "device-create-1"),
    ).toBe("customer-1");
    expect(rows.mutationClientOps).toHaveLength(1);
  });

  it("keeps identical operation keys isolated between organizations", async () => {
    const { ctx } = testContext();
    await rememberClientOp(ctx, {
      organizationId: "org-a" as never,
      clientOperationId: "same-key",
      kind: "create_customer",
      result: "customer-a",
    });
    expect(await replayClientOp(ctx, "org-b" as never, "same-key")).toBeNull();
  });

  it("wires the operation key through both the customer mutation and sync engine", () => {
    const customers = readFileSync(resolve(process.cwd(), "convex/customers.ts"), "utf8");
    const sync = readFileSync(resolve(process.cwd(), "lib/offline/sync-engine.ts"), "utf8");
    expect(customers).toContain("clientOperationId: v.optional(v.string())");
    expect(customers).toContain("replayClientOp<Id<\"customers\">>");
    expect(customers).toContain('kind: "create_customer"');
    expect(sync).toContain("clientOperationId: claimed.clientOperationId");
  });
});
