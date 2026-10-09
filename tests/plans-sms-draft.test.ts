import { describe, expect, it } from "vitest";
import { MIN_MONTHLY_PRICE_GHS } from "@/convex/shared/plans";
import { SMS_MESSAGE_MAX } from "@/convex/shared/smsAudience";
import { buildPlansUpdateSmsDraft } from "@/features/platform/components/platform-plans-view";

describe("plans update SMS draft", () => {
  it("includes the public pricing URL and stays within SMS length", () => {
    const draft = buildPlansUpdateSmsDraft(MIN_MONTHLY_PRICE_GHS);
    expect(draft).toContain("https://www.novendpos.app/pricing");
    expect(draft).toContain(`GH₵${MIN_MONTHLY_PRICE_GHS}`);
    expect(draft.length).toBeGreaterThan(40);
    expect(draft.length).toBeLessThanOrEqual(SMS_MESSAGE_MAX);
  });
});
