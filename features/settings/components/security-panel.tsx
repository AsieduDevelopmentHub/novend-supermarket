"use client";

import { FormEvent, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { BiometricSecurityCard } from "@/features/settings/components/biometric-security-card";
import { NotificationsSettingsCard } from "@/features/settings/components/notifications-settings-card";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useNativeShell } from "@/hooks/use-native-shell";
import { useCurrentUser } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

/**
 * Security settings. Native cards render immediately — never wait on Convex —
 * so a slow or failed session query cannot freeze the Security tab.
 */
export function SecurityPanel() {
  const online = useConnectivity();
  const nativeShell = useNativeShell();
  const remote = useQuery(api.users.me, online ? {} : "skip");
  const { user: cachedUser } = useCurrentUser();
  const me = remote ?? cachedUser;
  const passwordReady = Boolean(me && !me.needsProfile);

  return (
    <div className="grid max-w-2xl gap-6">
      {nativeShell ? (
        <>
          <BiometricSecurityCard />
          <NotificationsSettingsCard />
        </>
      ) : null}
      {passwordReady ? (
        <PasswordForm readOnly={!online} />
      ) : (
        <Card>
          <CardContent className="text-muted-foreground p-5 text-sm">
            {me?.needsProfile
              ? "Complete your profile before changing your password."
              : online
                ? "Loading account…"
                : "Sign in while online once to manage your password on this device."}
          </CardContent>
        </Card>
      )}
    </div>
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
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
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
            />
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
            {readOnly
              ? "Needs a connection"
              : savingPassword
                ? "Updating…"
                : "Update password"}
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
