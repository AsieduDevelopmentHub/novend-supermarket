import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  renderEmailOtpEmail,
  renderPasswordChangedEmail,
  renderPasswordResetEmail,
} from "@/convex/shared/emailTemplates";
import { EMAIL_LOGO_CONTENT_ID } from "@/convex/shared/emailLogoBase64";

describe("transactional email templates", () => {
  it("renders a password-reset message with a CTA, expiry, and escaped URL", () => {
    const resetUrl = "https://app.novend.app/reset-password?token=abc<script>1";
    const email = renderPasswordResetEmail({
      resetUrl,
      expiresInHours: 1,
    });
    expect(email.subject).toContain("password");
    expect(email.text).toContain(resetUrl);
    expect(email.text).toContain("expires in 1 hour");
    expect(email.html).toContain("Choose a new password");
    expect(email.html).toContain("expires in 1 hour");
    expect(email.html).toContain(escapeHtml(resetUrl));
    expect(email.html).not.toContain("<script>1");
    expect(email.html).toContain(`cid:${EMAIL_LOGO_CONTENT_ID}`);
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
    expect(email.html).toContain(`cid:${EMAIL_LOGO_CONTENT_ID}`);
  });

  it("renders a verification OTP without relying on a remote image URL", () => {
    const email = renderEmailOtpEmail({ code: "482179", expiresInMinutes: 10 });
    expect(email.text).toContain("482179");
    expect(email.html).toContain("482179");
    expect(email.html).toContain(`cid:${EMAIL_LOGO_CONTENT_ID}`);
    expect(email.html).not.toContain("http://localhost");
    expect(email.html).not.toContain("/branding/");
  });
});
