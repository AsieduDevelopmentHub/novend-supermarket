import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appEntryHref,
  hostnameFromOrigin,
  publicSiteHref,
  hostsMatch,
  isHostSplit,
  normalizeHostname,
  resolveHostingOrigins,
  shouldRedirectAuthenticatedHome,
} from "@/lib/hosting/hosts";

describe("hosting hosts", () => {
  it("parses hostnames from origins and bare hosts", () => {
    expect(hostnameFromOrigin("https://dashboard.novendpos.app/path")).toBe(
      "dashboard.novendpos.app",
    );
    expect(hostnameFromOrigin("dashboard.novendpos.app")).toBe("dashboard.novendpos.app");
    expect(hostnameFromOrigin("")).toBeNull();
  });

  it("treats www as equivalent to the apex", () => {
    expect(normalizeHostname("www.novendpos.app:443")).toBe("novendpos.app");
    expect(hostsMatch("www.novendpos.app", "novendpos.app")).toBe(true);
    expect(hostsMatch("dashboard.novendpos.app", "novendpos.app")).toBe(false);
  });

  it("keeps authenticated home redirect when hosts are unsplit", () => {
    expect(
      shouldRedirectAuthenticatedHome({
        requestHost: "novend-pos.vercel.app",
        appOrigin: "https://novend-pos.vercel.app",
        marketingOrigin: null,
      }),
    ).toBe(true);

    expect(
      shouldRedirectAuthenticatedHome({
        requestHost: "localhost:3000",
        appOrigin: "http://localhost:3000",
        marketingOrigin: "http://localhost:3000",
      }),
    ).toBe(true);
  });

  it("keeps landing on the marketing host when app host differs", () => {
    expect(
      shouldRedirectAuthenticatedHome({
        requestHost: "www.novendpos.app",
        appOrigin: "https://dashboard.novendpos.app",
        marketingOrigin: "https://www.novendpos.app",
      }),
    ).toBe(false);

    expect(
      shouldRedirectAuthenticatedHome({
        requestHost: "novendpos.app",
        appOrigin: "https://dashboard.novendpos.app",
        marketingOrigin: "https://www.novendpos.app",
      }),
    ).toBe(false);
  });

  it("still redirects authenticated home on the app host", () => {
    expect(
      shouldRedirectAuthenticatedHome({
        requestHost: "dashboard.novendpos.app",
        appOrigin: "https://dashboard.novendpos.app",
        marketingOrigin: "https://www.novendpos.app",
      }),
    ).toBe(true);
  });

  it("resolves origins from env with safe precedence", () => {
    expect(
      resolveHostingOrigins({
        NEXT_PUBLIC_APP_URL: "https://dashboard.novendpos.app",
        NOVEND_APP_URL: "https://legacy.example",
        NEXT_PUBLIC_SITE_URL: "https://www.novendpos.app",
        NEXT_PUBLIC_MARKETING_URL: "https://www.novendpos.app",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      appOrigin: "https://dashboard.novendpos.app",
      marketingOrigin: "https://www.novendpos.app",
    });
  });

  it("falls marketing origin back to SITE_URL when MARKETING_URL is unset", () => {
    expect(
      resolveHostingOrigins({
        NEXT_PUBLIC_APP_URL: "https://dashboard.novendpos.app",
        NEXT_PUBLIC_SITE_URL: "https://www.novendpos.app",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      appOrigin: "https://dashboard.novendpos.app",
      marketingOrigin: "https://www.novendpos.app",
    });
  });

  it("builds absolute app entry hrefs when hosts are split", () => {
    const env = {
      NEXT_PUBLIC_APP_URL: "https://dashboard.novendpos.app",
      NEXT_PUBLIC_MARKETING_URL: "https://www.novendpos.app",
    } as unknown as NodeJS.ProcessEnv;

    expect(isHostSplit(env)).toBe(true);
    expect(appEntryHref("/login", env)).toBe("https://dashboard.novendpos.app/login");
    expect(appEntryHref("/signup", env)).toBe("https://dashboard.novendpos.app/signup");
    expect(appEntryHref("/dashboard", env)).toBe("https://dashboard.novendpos.app/dashboard");
  });

  it("default hrefs follow inlined public URLs and ignore server-only NOVEND_APP_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dashboard.novendpos.app");
    vi.stubEnv("NEXT_PUBLIC_MARKETING_URL", "https://www.novendpos.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NOVEND_APP_URL", "https://www.novend.com");
    vi.resetModules();

    const hosts = await import("@/lib/hosting/hosts");
    expect(hosts.resolveHostingOrigins().appOrigin).toBe("https://dashboard.novendpos.app");
    expect(hosts.appEntryHref("/signup")).toBe("https://dashboard.novendpos.app/signup");
  });

  it("keeps sign-in and home on the marketing host", () => {
    const env = {
      NEXT_PUBLIC_APP_URL: "https://dashboard.novendpos.app",
      NEXT_PUBLIC_MARKETING_URL: "https://www.novendpos.app",
    } as unknown as NodeJS.ProcessEnv;

    expect(publicSiteHref("/login", "www.novendpos.app", env)).toBe("/login");
    expect(publicSiteHref("/", "localhost:3000", env)).toBe("/");
    expect(publicSiteHref("/", "dashboard.novendpos.app", env)).toBe("https://www.novendpos.app/");
    expect(publicSiteHref("/login", "dashboard.novendpos.app", env)).toBe(
      "https://www.novendpos.app/login",
    );
  });

  it("keeps relative auth hrefs when hosts are unsplit", () => {
    const env = {
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    } as unknown as NodeJS.ProcessEnv;

    expect(isHostSplit(env)).toBe(false);
    expect(appEntryHref("/login", env)).toBe("/login");
    expect(appEntryHref("/signup", env)).toBe("/signup");
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
