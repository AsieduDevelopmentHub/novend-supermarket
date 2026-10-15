"use client";

import { FormEvent, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { BiometricSecurityCard } from "@/features/settings/components/biometric-security-card";
import { IdleLockSettingsCard } from "@/features/settings/components/idle-lock-settings-card";
import { NotificationsSettingsCard } from "@/features/settings/components/notifications-settings-card";
import { VerifyEmailDialog } from "@/features/auth/components/verify-email-dialog";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useNativeShell } from "@/hooks/use-native-shell";
import { useCurrentUser } from "@/hooks/use-permissions";
import { milliesResetStaffPassword } from "@/lib/offline/millies-users";
import { readMilliesSession } from "@/lib/offline/millies-auth";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { PasswordStrengthMeter } from "@/features/auth/components/password-strength";
import { PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from "@/convex/shared/passwordPolicy";

/**
 * Security settings. Native cards render immediately — never wait on Convex —
 * so a slow or failed session query cannot freeze the Security tab.
 */
export function SecurityPanel() {
  const online = useConnectivity();
  const nativeShell = useNativeShell();
  const remote = useQuery(api.users.me, !FULLY_OFFLINE && online ? {} : "skip");
  const { user: cachedUser } = useCurrentUser();
  const me = remote ?? cachedUser;
  const passwordReady = Boolean(me && !me.needsProfile);

  if (FULLY_OFFLINE) {
    return (
      <div className="grid max-w-2xl gap-6">
        <IdleLockSettingsCard />
        {nativeShell ? <BiometricSecurityCard /> : null}
        <MilliesPasswordForm />
      </div>
    );
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <IdleLockSettingsCard />
      {nativeShell ? (
        <>
          <BiometricSecurityCard />
          <NotificationsSettingsCard />
        </>
      ) : null}
      {passwordReady ? (
        <>
          <EmailVerificationCard
            email={me?.email ?? null}
            emailVerified={remote?.emailVerified === true}
            online={online}
          />
          <PasswordForm readOnly={!online} />
        </>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground p-5 text-sm">
            {me?.needsProfile
              ? "Complete your profile before changing your password."
              : online
                ? "Account details are still syncing. You can use the device security controls above; reconnect or refresh to manage your password."
                : "Sign in while online once to manage your password on this device."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MilliesPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const session = readMilliesSession();
    if (!session) {
      toast.error("Sign in again to change your password");
      return;
    }
    if (newPassword.trim().length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await milliesResetStaffPassword(session.id, newPassword);
      toast.success("Password updated on this till");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      showError(error, "Could not change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="millies-new-password">New password</Label>
            <PasswordInput
              id="millies-new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="millies-confirm-password">Confirm password</Label>
            <PasswordInput
              id="millies-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EmailVerificationCard({
  email,
  emailVerified,
  online,
}: {
  email: string | null;
  emailVerified: boolean;
  online: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {emailVerified ? "Your email is verified." : "Your email is not verified yet."}
        </p>
        {email ? <p className="text-muted-foreground text-sm">{email}</p> : null}
        <p className="text-muted-foreground text-xs">
          Change your sign-in email in Profile. We will send a code to verify the new address.
        </p>
        {!emailVerified ? (
          <Button type="button" disabled={!online} onClick={() => setOpen(true)}>
            Verify email
          </Button>
        ) : null}
        <VerifyEmailDialog open={open} onOpenChange={setOpen} />
      </CardContent>
    </Card>
  );
}

function PasswordForm({ readOnly = false }: { readOnly?: boolean }) {
  const changePassword = useAction(api.users.changePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    if (readOnly) {
      toast.message("Reconnect to change your password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (!passwordMeetsPolicy(newPassword)) {
      toast.error(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include uppercase, lowercase, and a number`,
      );
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated. We sent a confirmation to your email.");
    } catch (error) {
      showError(error, "Could not change password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        {readOnly ? (
          <p className="text-muted-foreground mb-4 text-sm">
            Password changes require an internet connection.
          </p>
        ) : null}
        <form className="space-y-4" onSubmit={onChangePassword}>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={readOnly}
              minLength={PASSWORD_MIN_LENGTH}
            />
            <PasswordStrengthMeter password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={readOnly}
            />
          </div>
          <Button type="submit" disabled={savingPassword || readOnly}>
            {readOnly ? "Needs a connection" : savingPassword ? "Updating…" : "Update password"}
          </Button>
          {readOnly ? (
            <p className="text-muted-foreground text-sm">
              Password changes are stored securely in the cloud, so they need an internet
              connection. Everything else in Novend still works on this device.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
