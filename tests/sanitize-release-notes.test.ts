import { describe, expect, it } from "vitest";
import {
  extractWhatsNewSection,
  sanitizeReleaseNoteLines,
} from "@/lib/sanitize-release-notes";

describe("sanitizeReleaseNoteLines", () => {
  it("prefers ### What's new bullets over engineering sections", () => {
    const notes = [
      "## What's new",
      "",
      "- Desktop stays usable offline",
      "- Switch cameras while scanning",
      "",
      "### Fixed",
      "",
      "- Platform repair `repairs.clearTradingHistory` wipes sales",
      "- Electron offline stay=1 flicker",
    ].join("\n");

    expect(sanitizeReleaseNoteLines(notes)).toEqual([
      "Desktop stays usable offline",
      "Switch cameras while scanning",
    ]);
  });

  it("drops API identifiers and tech jargon when What's new is missing", () => {
    const notes = [
      "- repairs.clearTradingHistory wipes trading history",
      "- Capacitor WebView freezes on backup_only",
      "- Inventory low-stock alerts now match every branch",
    ].join("\n");

    expect(sanitizeReleaseNoteLines(notes)).toEqual([
      "Inventory low-stock alerts now match every branch",
    ]);
  });

  it("deduplicates identical lines", () => {
    const notes = ["- One shared highlight", "- One shared highlight"].join("\n");
    expect(sanitizeReleaseNoteLines(notes)).toEqual(["One shared highlight"]);
  });
});

describe("extractWhatsNewSection", () => {
  it("returns null when the customer section is absent", () => {
    expect(extractWhatsNewSection("### Fixed\n\n- something")).toBeNull();
  });
});
