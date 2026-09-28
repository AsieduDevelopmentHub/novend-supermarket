import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LANDING_SOCIAL_LINKS, LANDING_WHATSAPP_COMMUNITY_HREF } from "@/features/marketing/content";

describe("marketing contact + WhatsApp community", () => {
  it("does not link the Auralenx studio site from marketing socials", () => {
    expect(LANDING_SOCIAL_LINKS.some((link) => link.href.includes("auralenx"))).toBe(false);
    const ids = LANDING_SOCIAL_LINKS.map((link) => String(link.id));
    expect(ids.includes("website")).toBe(false);
  });

  it("exposes a floating WhatsApp community CTA on marketing chrome", () => {
    const shell = readFileSync(
      resolve(process.cwd(), "features/marketing/components/marketing-site-shell.tsx"),
      "utf8",
    );
    const landing = readFileSync(
      resolve(process.cwd(), "features/marketing/components/landing-page.tsx"),
      "utf8",
    );
    const fab = readFileSync(
      resolve(process.cwd(), "features/marketing/components/floating-whatsapp-community.tsx"),
      "utf8",
    );
    expect(shell).toContain("FloatingWhatsAppCommunity");
    expect(landing).toContain("FloatingWhatsAppCommunity");
    expect(fab).toContain("LANDING_WHATSAPP_COMMUNITY_HREF");
    expect(LANDING_WHATSAPP_COMMUNITY_HREF).toContain("chat.whatsapp.com");
  });
});
