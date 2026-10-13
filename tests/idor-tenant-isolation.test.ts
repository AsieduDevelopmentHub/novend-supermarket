import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertOrgDoc } from "@/convex/shared/permissions";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Unit-style tenant-isolation guards for the wholesale / credit / pricing surface.
 * This does NOT replace a live two-organization run against staging; it proves the
 * guards exist and are wired to every public function in the new modules.
 */

const ORG_A = "org_a" as Id<"organizations">;
const ORG_B = "org_b" as Id<"organizations">;

function readModule(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

interface ConvexExport {
  name: string;
  kind: "query" | "mutation";
  body: string;
}

function convexExports(source: string): ConvexExport[] {
  const starts = [...source.matchAll(/export const (\w+) = (query|mutation)\(/g)];
  return starts.map((match, index) => {
    const from = match.index ?? 0;
    const to = starts[index + 1]?.index ?? source.length;
    return { name: match[1], kind: match[2] as ConvexExport["kind"], body: source.slice(from, to) };
  });
}

describe("assertOrgDoc", () => {
  it("rejects documents from another organization and missing documents", () => {
    expect(() => assertOrgDoc({ organizationId: ORG_A }, ORG_B)).toThrow(/not found/i);
    expect(() => assertOrgDoc(null, ORG_A)).toThrow(/not found/i);
    expect(() => assertOrgDoc({ organizationId: ORG_A }, ORG_A)).not.toThrow();
  });
});

describe.each([["convex/customerLedger.ts"], ["convex/priceLists.ts"], ["convex/wholesale.ts"]])(
  "%s public functions",
  (path) => {
    const exports = convexExports(readModule(path));

    it("exposes at least one function", () => {
      expect(exports.length).toBeGreaterThan(0);
    });

    it("authenticates through requireRole / requireProfile on every function", () => {
      for (const fn of exports) {
        expect(fn.body, `${path}:${fn.name}`).toMatch(
          /requireRole\(|requireProfile\(|requireOrgContext\(/,
        );
      }
    });

    it("never trusts a client-supplied organization id", () => {
      for (const fn of exports) {
        expect(fn.body, `${path}:${fn.name}`).not.toMatch(/organizationId:\s*v\./);
        expect(fn.body, `${path}:${fn.name}`).not.toMatch(/args\.organizationId/);
      }
    });
  },
);

describe("cross-organization references on writes", () => {
  it("verifies customer, product, category and group ownership after db.get", () => {
    const ledger = convexExports(readModule("convex/customerLedger.ts"));
    const recordPayment = ledger.find((fn) => fn.name === "recordPayment");
    expect(recordPayment?.body).toMatch(/assertOrgDoc\(customer, organizationId\)/);

    const prices = convexExports(readModule("convex/priceLists.ts"));
    const saveRule = prices.find((fn) => fn.name === "saveRule");
    expect(saveRule?.body).toMatch(/assertOrgDoc\(product, organizationId\)/);
    expect(saveRule?.body).toMatch(/assertOrgDoc\(category, organizationId\)/);
    expect(saveRule?.body).toMatch(/assertOrgDoc\(group, organizationId\)/);
    expect(prices.find((fn) => fn.name === "saveGroup")?.body).toMatch(
      /assertOrgDoc\(existing, organizationId\)/,
    );
  });

  it("drops reads of another organization's customer instead of leaking balances", () => {
    const ledger = convexExports(readModule("convex/customerLedger.ts"));
    for (const name of ["listForCustomer", "balance"]) {
      expect(ledger.find((fn) => fn.name === name)?.body).toMatch(
        /customer\.organizationId !== organizationId\) return/,
      );
    }
  });
});

describe("role boundaries", () => {
  it("keeps ledger lists, payments and aging away from cashiers", () => {
    const ledger = convexExports(readModule("convex/customerLedger.ts"));
    for (const name of ["listForCustomer", "recordPayment", "agingSummary"]) {
      const body = ledger.find((fn) => fn.name === name)?.body ?? "";
      expect(body, name).toMatch(/requireRole\(ctx, \["administrator", "manager"\]\)/);
    }
  });

  it("limits price-list management to managers and administrators", () => {
    for (const fn of convexExports(readModule("convex/priceLists.ts"))) {
      expect(fn.body, fn.name).toMatch(/requireRole\(ctx, \["administrator", "manager"\]\)/);
    }
  });
});

describe("feature and capability gates", () => {
  it("gates wholesale writes on the inventory.wholesale feature", () => {
    const wholesale = convexExports(readModule("convex/wholesale.ts"));
    for (const name of ["recordPurchase", "transferToBranch"]) {
      expect(wholesale.find((fn) => fn.name === name)?.body, name).toMatch(
        /assertOrganizationFeature\(ctx, organization, "inventory\.wholesale"\)/,
      );
    }
  });

  it("gates credit payments on the customer_credit capability", () => {
    const source = readModule("convex/customerLedger.ts");
    expect(source).toMatch(/customer_credit/);
    const recordPayment = convexExports(source).find((fn) => fn.name === "recordPayment");
    expect(recordPayment?.body).toMatch(/assertCreditEnabled\(/);
  });
});
