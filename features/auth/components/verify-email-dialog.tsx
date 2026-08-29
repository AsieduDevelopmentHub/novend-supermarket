"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OtpDigitInputs } from "@/features/auth/components/otp-digit-inputs";
import { useConnectivity } from "@/hooks/use-connectivity";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Skip the automatic send when the caller already issued a code. */
  autoRequest?: boolean;
};

export function VerifyEmailDialog({ open, onOpenChange, autoRequest = true }: Props) {
  const online = useConnectivity();
  const status = useQuery(api.emailVerification.status, open && online ? {} : "skip");
  const requestCode = useAction(api.emailVerification.requestEmailVerification);
  const verifyCode = useAction(api.emailVerification.verifyEmailOtp);
  const changeEmail = useAction(api.emailVerification.changeOwnEmail);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [nextEmail, setNextEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [resendInMs, setResendInMs] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !online) return;
    setCode("");
    setChangingEmail(false);
    setNextEmail("");
    setCurrentPassword("");
    if (!autoRequest) {
      setResendInMs(60_000);
      return;
    }
    void requestCode()
      .then((result) => {
        setMaskedEmail(result.maskedEmail);
        if (result.alreadyVerified) {
          toast.success("Your email is already verified.");
          onOpenChange(false);
          return;
        }
        setResendInMs(result.retryAfterMs ?? 60_000);
      })
      .catch((error) => {
        showError(error, "Could not send a verification code right now.");
      });
  }, [open, online, autoRequest, onOpenChange, requestCode]);

  useEffect(() => {
    if (status?.maskedEmail) setMaskedEmail(status.maskedEmail);
  }, [status?.maskedEmail]);

  useEffect(() => {
    if (resendInMs <= 0) return;
    const timer = window.setInterval(() => {
      setResendInMs((current) => Math.max(0, current - 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendInMs]);

  async function onVerify(event?: FormEvent) {
    event?.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) return;
    setPending(true);
    try {
      await verifyCode({ code });
      toast.success("Email verified.");
      onOpenChange(false);
    } catch (error) {
      showError(error, "That code is incorrect or has expired.");
      setCode("");
    } finally {
      setPending(false);
    }
  }

  async function onResend() {
    setPending(true);
    try {
      const result = await requestCode();
      setMaskedEmail(result.maskedEmail);
      setResendInMs(result.retryAfterMs ?? 60_000);
      toast.success("If the mailbox exists, we sent a new code.");
    } catch (error) {
      showError(error, "Could not send a verification code right now.");
    } finally {
      setPending(false);
    }
  }

  async function onChangeEmail(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await changeEmail({ email: nextEmail, currentPassword });
      setMaskedEmail(result.maskedEmail);
      setChangingEmail(false);
      setNextEmail("");
      setCurrentPassword("");
      setCode("");
      setResendInMs(result.retryAfterMs ?? 60_000);
      toast.success("We sent a new code to your updated email.");
    } catch (error) {
      showError(error, "That email cannot be used.");
    } finally {
      setPending(false);
    }
  }

  const shownEmail = maskedEmail ?? status?.maskedEmail ?? "your email";
  const resendSeconds = Math.ceil(resendInMs / 1000);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify your email</DialogTitle>
          <DialogDescription>
            We sent a 6-digit verification code to {shownEmail}.
          </DialogDescription>
        </DialogHeader>

        {changingEmail ? (
          <form className="space-y-4" onSubmit={(event) => void onChangeEmail(event)}>
            <div className="space-y-2">
              <Label htmlFor="verify-email-next">New email</Label>
              <Input
                id="verify-email-next"
                type="email"
                autoComplete="email"
                value={nextEmail}
                onChange={(event) => setNextEmail(event.target.value)}
                placeholder="you@business.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-email-password">Current password</Label>
              <PasswordInput
                id="verify-email-password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="h-11 flex-1" disabled={pending || !online}>
                {pending ? "Updating…" : "Send code to new email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setChangingEmail(false)}
              >
                Back
              </Button>
            </div>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void onVerify(event)}>
            <OtpDigitInputs value={code} onChange={setCode} disabled={pending || !online} />
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={pending || !online || code.replace(/\D/g, "").length !== 6}
            >
              {pending ? "Verifying…" : "Verify"}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                disabled={pending || !online || resendInMs > 0}
                onClick={() => void onResend()}
              >
                {resendInMs > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => setChangingEmail(true)}
              >
                Change email
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
