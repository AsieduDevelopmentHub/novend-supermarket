import { describe, expect, it } from "vitest";
import {
  issueLicenseKey,
  verifyLicenseKey,
  normalizeLicenseKeyInput,
  LICENSE_PREFIX,
} from "@/lib/millies-license";

describe("millies offline license", () => {
  it("issues and verifies a perpetual NMIL key", async () => {
    const key = await issueLicenseKey({
      c: "Millie's Main",
      i: Date.now(),
      e: null,
      m: null,
    });
    expect(key.startsWith(`${LICENSE_PREFIX}.`)).toBe(true);
    const payload = await verifyLicenseKey(key);
    expect(payload.c).toBe("Millie's Main");
    expect(payload.e).toBeNull();
  });

  it("rejects wrong prefix and bad signatures", async () => {
    await expect(verifyLicenseKey("NCHM.abc.def")).rejects.toThrow(/NMIL/);
    const key = await issueLicenseKey({
      c: "Store",
      i: Date.now(),
      e: null,
      m: null,
    });
    const tampered = `${key.slice(0, -4)}xxxx`;
    await expect(verifyLicenseKey(tampered)).rejects.toThrow(/signature/i);
  });

  it("normalizes whitespace in keyed input", () => {
    expect(normalizeLicenseKeyInput("  NMIL.abc.def  ")).toBe("NMIL.abc.def");
  });
});
