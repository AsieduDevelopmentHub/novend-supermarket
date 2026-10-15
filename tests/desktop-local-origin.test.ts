import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Millie's desktop local origin", () => {
  it("desktop-config never defaults to a hosted Novend URL", () => {
    const source = readFileSync(
      resolve(process.cwd(), "apps/desktop/src/desktop-config.ts"),
      "utf8",
    );
    expect(source).toContain('DEV_APP_URL = "http://127.0.0.1:3737"');
    expect(source).not.toContain("dashboard.novendpos.app");
    expect(source).toContain("shouldStartBundledServer");
  });

  it("main process starts the bundled local server for packaged builds", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/desktop/src/main.ts"), "utf8");
    expect(source).toContain("startLocalServer");
    expect(source).toContain("shouldStartBundledServer");
    expect(source).toContain("stopLocalServer");
  });

  it("prepare script copies Next standalone into resources/app-server", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/prepare-desktop-app-server.mjs"),
      "utf8",
    );
    expect(source).toContain("apps");
    expect(source).toContain("resources");
    expect(source).toContain("app-server");
    expect(source).toContain(".next/standalone");
  });

  it("update-config bake leaves appUrl empty by default", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/write-desktop-update-config.mjs"),
      "utf8",
    );
    expect(source).not.toContain("dashboard.novendpos.app");
    expect(source).toContain("appUrl: appUrl || null");
  });
});
