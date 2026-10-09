import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isStaleClientError, toUserMessage } from "@/lib/errors";

describe("stale server-action recovery", () => {
  it("detects Convex Auth invalidateCache misses after a deploy", () => {
    const error = new Error(
      'Server Action "00c87a2790661c26f594a2428f4f2908055b355bb3" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action',
    );
    expect(isStaleClientError(error)).toBe(true);
    expect(toUserMessage(error)).toMatch(/quick refresh/i);
    expect(toUserMessage(error)).not.toMatch(/00c87a/i);
  });

  it("wraps Convex Auth onChange so a stale action cannot fail sign-in", () => {
    const patch = readFileSync(
      resolve(process.cwd(), "patches/@convex-dev__auth@0.0.87.patch"),
      "utf8",
    );
    expect(patch).toContain("safeInvalidateCache");
    expect(patch).toContain("onChange: safeInvalidateCache");
    const workspace = readFileSync(resolve(process.cwd(), "pnpm-workspace.yaml"), "utf8");
    expect(workspace).toContain('"@convex-dev/auth@0.0.87": patches/@convex-dev__auth@0.0.87.patch');
  });

  it("intercepts Sonner toasts that leak the action id", () => {
    const source = readFileSync(
      resolve(process.cwd(), "features/auth/components/stale-client-recovery.tsx"),
      "utf8",
    );
    expect(source).toContain("toast.error =");
    expect(source).toContain("MutationObserver");
    expect(source).toContain("recoverStaleClient");
    expect(source).toContain("unhandledrejection");
    expect(source).toContain("isServiceWorkerRegistrationError");
    expect(source).toContain("combinedToastText");
  });
});
