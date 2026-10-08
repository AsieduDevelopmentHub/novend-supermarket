import { describe, expect, it } from "vitest";
import { gaEventForLink } from "@/lib/analytics/ga-events";

const origin = "https://novendpos.app";

describe("gaEventForLink", () => {
  it("maps trial, WhatsApp, sales, and download links", () => {
    expect(gaEventForLink("https://app.novendpos.app/signup", origin, null)?.name).toBe(
      "start_free_trial",
    );
    expect(gaEventForLink("https://wa.me/233555257482", origin, null)?.name).toBe(
      "contact_whatsapp",
    );
    expect(
      gaEventForLink("mailto:sales@novendpos.app?subject=Novend%20Sales%20Inquiry", origin, null)
        ?.name,
    ).toBe("contact_sales");
    expect(gaEventForLink("https://cdn.example/Novend-Setup.exe", origin, null)?.name).toBe(
      "download_desktop",
    );
    expect(gaEventForLink("https://cdn.example/novend.apk", origin, null)?.name).toBe(
      "download_android",
    );
    expect(gaEventForLink("https://play.google.com/store/apps/details?id=app", origin, null)?.name).toBe(
      "download_android",
    );
  });

  it("ignores ordinary links and honors an explicit funnel mark", () => {
    expect(gaEventForLink("https://novendpos.app/product", origin, null)).toBeNull();
    expect(gaEventForLink("https://novendpos.app/contact", origin, "demo_request")?.name).toBe(
      "demo_request",
    );
    expect(gaEventForLink("https://novendpos.app/contact", origin, "email")).toBeNull();
  });
});
