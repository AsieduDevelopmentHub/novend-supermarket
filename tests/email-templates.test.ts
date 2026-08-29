import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  renderPasswordChangedEmail,
  renderPasswordResetEmail,
} from "@/convex/shared/emailTemplates";
import { emailLogoUrl } from "@/convex/shared/transactionalEmail";

describe("transactional email templates", () => {
  it("renders a password-reset message with a CTA, expiry, and escaped URL", () => {
    const resetUrl = "https://app.novend.app/reset-password?token=abc<script>1";
    const email = renderPasswordResetEmail({
      resetUrl,
      expiresInHours: 1,
      logoUrl: "https://app.novend.app/branding/logo_horizontal_light.png",
    });
    expect(email.subject).toContain("password");
    expect(email.text).toContain(resetUrl);
    expect(email.text).toContain("expires in 1 hour");
    expect(email.html).toContain("Choose a new password");
    expect(email.html).toContain("expires in 1 hour");
    expect(email.html).toContain(escapeHtml(resetUrl));
    expect(email.html).not.toContain("<script>1");
    expect(email.html).toContain("logo_horizontal_light.png");
  });

  it("renders a password-changed notice with a recovery path", () => {
    const email = renderPasswordChangedEmail({
      signInUrl: "https://app.novend.app/login",
      resetUrl: "https://app.novend.app/forgot-password",
    });
    expect(email.subject).toContain("password was changed");
    expect(email.text).toContain("If you did not make this change");
    expect(email.html).toContain("/forgot-password");
    expect(email.html).toContain("Other signed-in devices were signed out");
  });

  it("does not attach a remote logo for localhost origins", () => {
    expect(emailLogoUrl("http://localhost:3000")).toBeUndefined();
    expect(emailLogoUrl("https://app.novend.app")).toBe(
      "https://app.novend.app/branding/logo_horizontal_light.png",
    );
  });
});
