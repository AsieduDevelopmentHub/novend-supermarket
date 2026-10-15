import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MILLIES_DEV_PORT, MILLIES_PACKAGED_PORT } from "../constants/dev-server";
import {
  PACKAGED_LOCAL_ORIGIN,
  PACKAGED_LOCAL_PORT,
} from "../apps/desktop/src/desktop-config";

describe("Millie's fixed local till ports", () => {
  it("keeps packaged and desktop-config ports aligned", () => {
    expect(PACKAGED_LOCAL_PORT).toBe(MILLIES_PACKAGED_PORT);
    expect(PACKAGED_LOCAL_ORIGIN).toBe(`http://127.0.0.1:${MILLIES_PACKAGED_PORT}`);
    expect(MILLIES_PACKAGED_PORT).not.toBe(MILLIES_DEV_PORT);
  });

  it("does not allocate an ephemeral port in the packaged local server", () => {
    const source = readFileSync(
      resolve(process.cwd(), "apps/desktop/src/local-server.ts"),
      "utf8",
    );
    expect(source).toContain("PACKAGED_LOCAL_PORT");
    expect(source).toContain("assertFixedPortAvailable");
    expect(source).not.toMatch(/listen\(\s*0\s*,/);
  });
});
