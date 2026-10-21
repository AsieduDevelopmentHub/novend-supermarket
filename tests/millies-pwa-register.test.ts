import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "components/pwa-register.tsx"), "utf8");

describe("Millie's PWA register", () => {
  it("never registers a service worker when FULLY_OFFLINE", () => {
    expect(source).toContain('import { FULLY_OFFLINE } from "@/constants/runtime"');
    expect(source).toContain("if (FULLY_OFFLINE) return false;");
  });
});
