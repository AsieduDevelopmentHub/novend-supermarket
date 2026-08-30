import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const download = readFileSync(resolve(process.cwd(), "lib/export/download.ts"), "utf8");
const bridge = readFileSync(
  resolve(process.cwd(), "apps/mobile/android/app/src/main/java/com/novend/pos/NovendNativeBridge.java"),
  "utf8",
);
const activity = readFileSync(
  resolve(process.cwd(), "apps/mobile/android/app/src/main/java/com/novend/pos/MainActivity.java"),
  "utf8",
);

describe("Capacitor Downloads bridge", () => {
  it("writes files through NovendNative, not a Capacitor plugin call", () => {
    expect(download).toContain("NovendNative");
    expect(download).toContain("beginSave");
    expect(download).toContain("finishSave");
    expect(bridge).toContain('@JavascriptInterface');
    expect(bridge).toContain("MediaStore.Downloads");
    expect(activity).toContain('addJavascriptInterface(new NovendNativeBridge(this), "NovendNative")');
  });

  it("retries a hosted load with cache before stay=1", () => {
    expect(activity).toContain("LOAD_CACHE_ELSE_NETWORK");
    expect(activity).toContain("hostedFailures");
    expect(activity).toContain("https://localhost/?stay=1");
  });
});
