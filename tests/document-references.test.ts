import { describe, expect, it } from "vitest";
import {
  allocateInvoiceNumber,
  allocateReturnNumber,
  sanitizeInvoiceNumber,
  sanitizeReturnNumber,
} from "@/convex/shared/documentReferences";

describe("document references", () => {
  it("allocates INV- and RET- identifiers", () => {
    const invoice = allocateInvoiceNumber();
    const ret = allocateReturnNumber();
    expect(invoice).toMatch(/^INV-[A-F0-9]{16}$/);
    expect(ret).toMatch(/^RET-[A-F0-9]{16}$/);
    expect(invoice).not.toBe(allocateInvoiceNumber());
  });

  it("accepts the INV- number printed at checkout", () => {
    expect(sanitizeInvoiceNumber("INV-A1B2C3D4E5F60708")).toBe("INV-A1B2C3D4E5F60708");
    expect(sanitizeInvoiceNumber("inv-a1b2c3d4e5f60708")).toBe("INV-A1B2C3D4E5F60708");
    expect(sanitizeReturnNumber("RET-A1B2C3D4E5F60708")).toBe("RET-A1B2C3D4E5F60708");
  });

  it("rewrites a leftover OFF- prefix to INV- so queued sales still upload", () => {
    expect(sanitizeInvoiceNumber("off-a1b2c3-0001")).toBe("INV-A1B2C3-0001");
  });

  it("rejects numbers that could not have been printed as invoices", () => {
    expect(() => sanitizeInvoiceNumber("SALE-1")).toThrow(/invalid invoice/i);
    expect(() => sanitizeInvoiceNumber("INV")).toThrow(/invalid invoice/i);
    expect(() => sanitizeReturnNumber("INV-A1B2C3D4E5F60708")).toThrow(/invalid return/i);
  });
});
