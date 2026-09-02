import { describe, expect, it } from "vitest";
import {
  buildCustomerDisplaySnapshot,
  idleCustomerDisplaySnapshot,
  parseCustomerDisplaySnapshot,
  type CustomerDisplaySnapshot,
} from "@/lib/sales/customer-display";

const branding = { tradeName: "East Legon Pharmacy", branchName: "Main", thankYouLine: "Thank you!" };

describe("customer display snapshot", () => {
  it("builds an active snapshot with line totals and item count", () => {
    const snapshot = buildCustomerDisplaySnapshot({
      phase: "active",
      items: [
        { productId: "p1", name: "Water", unitPrice: 2, quantity: 3, discount: 0 },
        { productId: "p2", name: "Bread", unitPrice: 5, quantity: 1, discount: 0.5 },
      ],
      imageByProductId: { p1: "https://example.com/water.png" },
      discountMode: "amount",
      discountField: 1,
      subtotal: 10.5,
      cartDiscount: 1,
      total: 9.5,
      customerName: "Ama",
      branding,
    });

    expect(snapshot.phase).toBe("active");
    expect(snapshot.itemCount).toBe(4);
    expect(snapshot.items[0]?.imageUrl).toBe("https://example.com/water.png");
    expect(snapshot.items[1]?.lineTotal).toBe(4.5);
    expect(snapshot.total).toBe(9.5);
    expect(snapshot.customerName).toBe("Ama");
  });

  it("parses a valid snapshot payload", () => {
    const sample: CustomerDisplaySnapshot = buildCustomerDisplaySnapshot({
      phase: "complete",
      items: [{ productId: "p1", name: "Water", unitPrice: 2, quantity: 1, discount: 0 }],
      discountMode: "percent",
      discountField: 10,
      subtotal: 2,
      cartDiscount: 0.2,
      total: 1.8,
      paymentMethod: "cash",
      invoiceNumber: "INV-001",
      completedAt: 1_700_000_000_000,
      branding,
    });

    const restored = parseCustomerDisplaySnapshot(JSON.stringify(sample));
    expect(restored?.phase).toBe("complete");
    expect(restored?.invoiceNumber).toBe("INV-001");
    expect(restored?.branding.tradeName).toBe("East Legon Pharmacy");
  });

  it("rejects corrupt or invalid payloads", () => {
    expect(parseCustomerDisplaySnapshot(null)).toBeNull();
    expect(parseCustomerDisplaySnapshot("{")).toBeNull();
    expect(
      parseCustomerDisplaySnapshot(
        JSON.stringify({
          version: 2,
          phase: "active",
          items: [],
          branding: { tradeName: "X" },
        }),
      ),
    ).toBeNull();
    expect(
      parseCustomerDisplaySnapshot(
        JSON.stringify({
          version: 1,
          phase: "active",
          items: [{ name: "bad" }],
          branding: { tradeName: "X" },
        }),
      ),
    ).toBeNull();
  });

  it("creates an idle snapshot with branding", () => {
    const idle = idleCustomerDisplaySnapshot(branding);
    expect(idle.phase).toBe("idle");
    expect(idle.items).toEqual([]);
    expect(idle.branding.thankYouLine).toBe("Thank you!");
  });
});
