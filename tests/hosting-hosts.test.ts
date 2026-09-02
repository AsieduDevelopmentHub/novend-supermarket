import { describe, expect, it } from "vitest";
import {
  hostnameFromOrigin,
  hostsMatch,
  normalizeHostname,
  resolveHostingOrigins,
  shouldRedirectAuthenticatedHome,
} from "@/lib/hosting/hosts";

describe("hosting hosts", () => {
  it("parses hostnames from origins and bare hosts", () => {
    expect(hostnameFromOrigin("https://app.novend.com/path")).toBe("app.novend.com");
    expect(hostnameFromOrigin("app.novend.com")).toBe("app.novend.com");
    expect(hostnameFromOrigin("")).toBeNull();
  });

  it("treats www as equivalent to the apex", () => {
    expect(normalizeHostname("www.novend.com:443")).toBe("novend.com");
    expect(hostsMatch("www.novend.com", "novend.com")).toBe(true);
    expect(hostsMatch("app.novend.com", "novend.com")).toBe(false);
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
        requestHost: "novend.com",
        appOrigin: "https://app.novend.com",
        marketingOrigin: "https://novend.com",
      }),
    ).toBe(false);

    expect(
      shouldRedirectAuthenticatedHome({
        requestHost: "www.novend.com",
        appOrigin: "https://app.novend.com",
        marketingOrigin: "https://novend.com",
      }),
    ).toBe(false);
  });

  it("still redirects authenticated home on the app host", () => {
    expect(
      shouldRedirectAuthenticatedHome({
        requestHost: "app.novend.com",
        appOrigin: "https://app.novend.com",
        marketingOrigin: "https://novend.com",
      }),
    ).toBe(true);
  });

  it("resolves origins from env with safe precedence", () => {
    expect(
      resolveHostingOrigins({
        NEXT_PUBLIC_APP_URL: "https://app.novend.com",
        NOVEND_APP_URL: "https://legacy.example",
        NEXT_PUBLIC_SITE_URL: "https://site.example",
        NEXT_PUBLIC_MARKETING_URL: "https://novend.com",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      appOrigin: "https://app.novend.com",
      marketingOrigin: "https://novend.com",
    });
  });
});
