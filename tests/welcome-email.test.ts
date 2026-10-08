import { describe, expect, it } from "vitest";
import { renderWelcomeEmail, welcomeSms } from "@/convex/shared/emailTemplates";

describe("welcome email", () => {
  it("uses the person's name and business, not a verification code", () => {
    const email = renderWelcomeEmail({
      name: "Ama",
      organizationName: "Minta Shop",
      signInUrl: "https://dashboard.novendpos.app/login",
    });
    expect(email.subject).toBe("Welcome to Novend");
    expect(email.text).toContain("Hi Ama");
    expect(email.text).toContain("Minta Shop");
    expect(email.text).not.toMatch(/\b\d{6}\b/);
    expect(email.html).toContain("Minta Shop");
    expect(email.html).not.toContain("verification code");
  });

  it("keeps the SMS short and personal", () => {
    const message = welcomeSms("Ama", "Minta Shop", "https://dashboard.novendpos.app/login");
    expect(message).toContain("Ama");
    expect(message).toContain("Minta Shop");
    expect(message.endsWith("https://dashboard.novendpos.app/login")).toBe(true);
    expect(message.length).toBeLessThanOrEqual(320);
  });
});
