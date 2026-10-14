"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { APP_BRAND, APP_NAME } from "@/constants/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { completeMilliesSetup } from "@/lib/offline/millies-auth";
import { toUserMessage } from "@/lib/errors";
import { toast } from "sonner";

export function MilliesSetupWizard() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    storeName: APP_BRAND,
    phone: "",
    address: "",
    adminUsername: "admin",
    adminDisplayName: "Administrator",
    adminPassword: "",
    confirmPassword: "",
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.adminPassword !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.adminPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await completeMilliesSetup({
        storeName: form.storeName,
        phone: form.phone,
        address: form.address,
        adminUsername: form.adminUsername,
        adminDisplayName: form.adminDisplayName,
        adminPassword: form.adminPassword,
      });
      setRecoveryKey(result.recoveryKeyDisplay);
      toast.success("Store ready");
    } catch (err) {
      setError(toUserMessage(err, "Setup could not be completed"));
    } finally {
      setBusy(false);
    }
  }

  if (recoveryKey) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Save your recovery key</CardTitle>
            <CardDescription>
              This key encrypts local backups. It is shown once — store it offline safely. You will
              need it to restore on a new machine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="bg-muted break-all rounded-lg p-4 font-mono text-sm tracking-wide">
              {recoveryKey}
            </pre>
            <Button
              className="w-full"
              type="button"
              onClick={() => {
                setRecoveryKey(null);
                router.replace("/sales");
              }}
            >
              I have saved the key — continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
            First boot
          </p>
          <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
          <CardDescription>
            Set up this machine as a fully offline supermarket till. No internet required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="storeName">Store name</Label>
              <Input
                id="storeName"
                required
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminUsername">Admin username</Label>
                <Input
                  id="adminUsername"
                  required
                  autoComplete="username"
                  value={form.adminUsername}
                  onChange={(e) => setForm({ ...form, adminUsername: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminDisplayName">Admin display name</Label>
              <Input
                id="adminDisplayName"
                required
                value={form.adminDisplayName}
                onChange={(e) => setForm({ ...form, adminDisplayName: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Admin password</Label>
                <PasswordInput
                  id="adminPassword"
                  required
                  autoComplete="new-password"
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <PasswordInput
                  id="confirmPassword"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
              </div>
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? "Setting up…" : "Create store"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
