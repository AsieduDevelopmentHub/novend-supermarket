import { describe, expect, it } from "vitest";
import { resolveExperienceTokens } from "@/convex/shared/organizationConfig";
import { DEFAULT_NOVEND_EXPERIENCE } from "@/convex/shared/experience";

describe("resolveExperienceTokens", () => {
  it("keeps focus ring on accent when org overrides accent only", () => {
    const resolved = resolveExperienceTokens(DEFAULT_NOVEND_EXPERIENCE, {
      accent: "#ea580c",
      accentForeground: "#ffffff",
    });
    expect(resolved.accent).toBe("#ea580c");
    expect(resolved.focusRing).toBe("#ea580c");
  });

  it("preserves preset focus ring when accent is not overridden", () => {
    const resolved = resolveExperienceTokens(
      {
        ...DEFAULT_NOVEND_EXPERIENCE,
        accent: "#38bdf8",
        focusRing: "#38bdf8",
      },
      {
        sidebarBackground: "#0f172a",
      },
    );
    expect(resolved.focusRing).toBe("#38bdf8");
    expect(resolved.sidebarBackground).toBe("#0f172a");
  });
});
