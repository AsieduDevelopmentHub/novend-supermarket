import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cap settings section + Android back exit", () => {
  it("settings section changes skip Next router.replace on Cap/Electron", () => {
    const view = readFileSync(
      resolve(process.cwd(), "features/settings/components/settings-view.tsx"),
      "utf8",
    );
    const helper = readFileSync(
      resolve(process.cwd(), "lib/navigation/client-shell-url.ts"),
      "utf8",
    );
    expect(helper).toContain("replaceClientShellUrl");
    expect(helper).toContain("history.replaceState");
    expect(helper).toContain("isCapacitor()");
    expect(helper).toContain("isElectron()");
    expect(view).toContain("replaceClientShellUrl(href)");
    expect(view).not.toContain('router.replace(`/settings?section=${value}`');
  });

  it("Android back uses canGoBack and double-press exit, not history.length", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/layout/native-app-services.tsx"),
      "utf8",
    );
    expect(source).toContain("addBackButtonListener");
    expect(source).toContain("EXIT_DOUBLE_BACK_MS");
    expect(source).toContain("Press back again to close Novend");
    expect(source).toContain("Hardware.app.exitApp()");
    expect(source).toContain("if (canGoBack)");
    expect(source).not.toContain("window.history.length > 1");
    expect(source).not.toContain("Leave Novend?");
  });
});
