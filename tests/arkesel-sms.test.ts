import { describe, expect, it } from "vitest";
import { normalizeSmsRecipient } from "@/convex/shared/arkeselSms";

describe("normalizeSmsRecipient", () => {
  it("normalizes Ghana local and international forms", () => {
    expect(normalizeSmsRecipient("0244123456")).toBe("+233244123456");
    expect(normalizeSmsRecipient("244123456")).toBe("+233244123456");
    expect(normalizeSmsRecipient("233244123456")).toBe("+233244123456");
    expect(normalizeSmsRecipient("+233244123456")).toBe("+233244123456");
  });

  it("rejects empty input", () => {
    expect(normalizeSmsRecipient("")).toBeNull();
    expect(normalizeSmsRecipient("   ")).toBeNull();
  });
});
