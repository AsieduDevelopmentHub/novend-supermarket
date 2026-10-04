import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const SOURCE_DIRS = ["app", "components", "features", "hooks", "providers"];

/**
 * Plain `useQuery` is allowed only for public queries, queries that return a
 * safe value when signed out, or call sites already gated on `isAuthenticated`.
 * Everything else must use `useAuthedQuery` — otherwise an offline shell that
 * regains the radio subscribes without a JWT and `requireRole` throws
 * Unauthenticated into the error boundary over the Connect-to-cloud prompt.
 */
const PLAIN_USE_QUERY_ALLOWED = new Set([
  "users.me",
  "platform.me",
  "accountClosure.status",
  "emailVerification.status",
  "desktopReleases.getInstallOffer",
  "desktopReleases.listPublicRecent",
  "mobileReleases.getInstallOffer",
  "mobileReleases.listPublicRecent",
  // Gated on isAuthenticated / platform.me at the call site.
  "billing.licenseSnapshot",
  "dashboard.summary",
  "dashboard.hospitalityOps",
  "pushNotifications.listMyOutbox",
  "desktopReleases.listRecent",
  "platform.overview",
  "platform.listOrganizations",
  "platform.getOrganization",
  "platformAnalytics.revenueAnalytics",
  "platformAnalytics.listSubscriptions",
  "platformAnalytics.systemHealth",
  "platformAnalytics.getPayment",
  "platformAnalytics.getReleaseBundle",
  "platformAnalytics.listReleaseBundles",
  "platformAnalytics.getInsightDetail",
  "platformAnalytics.listOperatingCosts",
  "platformMonitoring.dashboard",
]);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const plainQueryCalls = SOURCE_DIRS.flatMap((dir) => listSourceFiles(resolve(root, dir))).flatMap(
  (path) => {
    const source = readFileSync(path, "utf8");
    return [...source.matchAll(/\buseQuery\(\s*api\.([\w.]+)/g)].map((match) => ({
      file: relative(root, path).replaceAll("\\", "/"),
      fn: match[1]!,
    }));
  },
);

describe("Convex queries that need a session", () => {
  it("skip until Convex reports a JWT", () => {
    const hook = readFileSync(resolve(root, "hooks/use-authed-query.ts"), "utf8");
    expect(hook).toContain("useConvexAuth");
    expect(hook).toContain('isAuthenticated ? args : ["skip"]');
  });

  it("never subscribe through plain useQuery", () => {
    const offenders = plainQueryCalls
      .filter((call) => !PLAIN_USE_QUERY_ALLOWED.has(call.fn))
      .map((call) => `${call.file}: api.${call.fn}`);
    expect(offenders).toEqual([]);
  });

  it("keep paginated lists and data-source gates session-aware", () => {
    const paged = readFileSync(resolve(root, "hooks/use-convex-paged-list.ts"), "utf8");
    expect(paged).toContain("isAuthenticated && options?.enabled !== false");

    const gate = readFileSync(resolve(root, "hooks/use-business-data-gate.ts"), "utf8");
    expect(gate).toContain("shouldUseRemoteBusinessLists(liveSession)");

    const catalog = readFileSync(resolve(root, "hooks/use-offline-catalog.ts"), "utf8");
    expect(catalog).toContain("shouldUseRemoteSalesCatalog(liveSession)");
  });
});
