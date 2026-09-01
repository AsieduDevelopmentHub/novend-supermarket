"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import {
  ArrowRight,
  CloudDownload,
  HeartHandshake,
  PauseCircle,
  ShieldAlert,
  Sparkles,
  UserMinus,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ACCOUNT_CLOSURE_GRACE_DAYS } from "@/convex/shared/accountClosure";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePermissions } from "@/hooks/use-permissions";
import { signOutAndRedirect } from "@/lib/auth/sign-out";
import { formatDateTime } from "@/lib/date";
import { showError } from "@/lib/errors";
import { LANDING_CONTACT_EMAIL } from "@/features/marketing/content";
import { toast } from "sonner";

const CLOSURE_REASONS = [
  { value: "break", label: "Taking a break from the business" },
  { value: "switching", label: "Switching to another system" },
  { value: "cost", label: "Cost or billing concerns" },
  { value: "features", label: "Missing features I need" },
  { value: "support", label: "Support did not meet expectations" },
  { value: "other", label: "Something else" },
] as const;

/**
 * Store-compliant account / organization deletion with retention-first UX.
 * Deletion paths exist, but alternatives and recovery are surfaced first.
 */
export function PrivacyDataPanel() {
  const online = useConnectivity();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAdmin } = usePermissions();
  const closure = useQuery(api.accountClosure.status, online ? {} : "skip");
  const cancelClosure = useMutation(api.accountClosure.cancelOrganizationClosure);
  const requestClosure = useAction(api.accountClosure.requestOrganizationClosure);
  const deleteMyAccount = useAction(api.accountClosure.deleteMyAccount);

  const [restorePending, setRestorePending] = useState(false);
  const [closureStep, setClosureStep] = useState<0 | 1 | 2>(0);
  const [closureOpen, setClosureOpen] = useState(false);
  const [closureReason, setClosureReason] = useState<string>("");
  const [closurePassword, setClosurePassword] = useState("");
  const [closureConfirmName, setClosureConfirmName] = useState("");
  const [closurePending, setClosurePending] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePending, setDeletePending] = useState(false);

  if (!online) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-5 text-sm">
          Privacy and account deletion need an internet connection. Reconnect to manage your data or
          close your account.
        </CardContent>
      </Card>
    );
  }

  if (closure === undefined) {
    return <LoadingState label="Loading privacy settings…" variant="form" />;
  }

  if (!closure) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-5 text-sm">
          Sign in with a staff profile to manage account deletion.
        </CardContent>
      </Card>
    );
  }

  async function onRestore() {
    setRestorePending(true);
    try {
      await cancelClosure({});
      toast.success("Welcome back — your business stays open.");
    } catch (error) {
      showError(error, "Could not restore your business");
    } finally {
      setRestorePending(false);
    }
  }

  async function onConfirmClosure() {
    setClosurePending(true);
    try {
      const result = await requestClosure({
        currentPassword: closurePassword,
        confirmName: closureConfirmName,
        reason: closureReason || undefined,
      });
      setClosureOpen(false);
      setClosureStep(0);
      setClosurePassword("");
      setClosureConfirmName("");
      setClosureReason("");
      toast.success(
        `Closure scheduled. You can restore until ${formatDateTime(result.effectiveAt)}.`,
      );
    } catch (error) {
      showError(error, "Could not schedule closure");
    } finally {
      setClosurePending(false);
    }
  }

  async function onConfirmDeleteAccount() {
    setDeletePending(true);
    try {
      await deleteMyAccount({ currentPassword: deletePassword });
      setDeleteOpen(false);
      setDeletePassword("");
      toast.success("Your staff account was removed.");
      await signOutAndRedirect({ signOut, router });
    } catch (error) {
      showError(error, "Could not remove your account");
    } finally {
      setDeletePending(false);
    }
  }

  const statsLine = `You've built ${closure.stats.activeProducts} product${
    closure.stats.activeProducts === 1 ? "" : "s"
  } with ${closure.stats.activeStaff} team member${
    closure.stats.activeStaff === 1 ? "" : "s"
  } over ${closure.stats.memberSinceDays} day${closure.stats.memberSinceDays === 1 ? "" : "s"}.`;

  return (
    <div className="grid max-w-2xl gap-6">
      {closure.pendingClosure && closure.closureEffectiveAt ? (
        <Alert className="border-primary/30 bg-primary/5">
          <HeartHandshake className="h-4 w-4" aria-hidden />
          <AlertTitle>Your business is scheduled to close</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {closure.organizationName} enters read-only mode now. Permanent closure happens on{" "}
              <strong>{formatDateTime(closure.closureEffectiveAt)}</strong> unless you change your
              mind.
            </p>
            <Button type="button" disabled={restorePending} onClick={() => void onRestore()}>
              {restorePending ? "Restoring…" : "Keep my business — undo closure"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="text-primary h-5 w-5" aria-hidden />
              {closure.organizationName} is still growing
            </CardTitle>
            <CardDescription>{statsLine}</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Most owners who pause instead of closing come back within a few weeks. You can always
            export your records first — nothing has to be permanent today.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Before you delete anything</CardTitle>
          <CardDescription>
            App stores require a clear in-app path to delete your data. These options solve most
            problems without losing your history.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {isAdmin ? (
            <AlternativeRow
              icon={PauseCircle}
              title="Pause billing instead"
              description="Cancel renewal and keep selling until the period you already paid for ends."
              href="/settings?section=billing"
              actionLabel="Open billing"
            />
          ) : null}
          <AlternativeRow
            icon={CloudDownload}
            title="Export your records"
            description="Download catalogs, reports, and encrypted backups before any closure."
            href="/settings?section=backup"
            actionLabel="Open backups"
          />
          <AlternativeRow
            icon={HeartHandshake}
            title="Talk to us first"
            description="Many closure requests are billing or training issues we can fix in one conversation."
            href={`mailto:${LANDING_CONTACT_EMAIL}`}
            actionLabel="Email support"
            external
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your privacy rights</CardTitle>
          <CardDescription>
            Access, correction, and deletion are described in our Privacy Policy. Business records
            such as completed sales may be retained in anonymized form where the law requires it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" asChild>
            <Link href="/privacy">Read privacy policy</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" aria-hidden />
            Delete account or business
          </CardTitle>
          <CardDescription>
            These actions are deliberate and hard to undo. We give you {ACCOUNT_CLOSURE_GRACE_DAYS}{" "}
            days to change your mind on business closure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {closure.isOwner ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Close entire business</p>
              <p className="text-muted-foreground text-sm">
                Blocks every login, cancels renewal, and archives {closure.organizationName} after
                the grace period. Sales history is kept for audit — personal sign-in access ends.
              </p>
              <Button
                type="button"
                variant="destructive"
                disabled={closure.pendingClosure}
                onClick={() => {
                  setClosureStep(0);
                  setClosureOpen(true);
                }}
              >
                Close business account
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Remove my staff account</p>
              <p className="text-muted-foreground text-sm">
                Signs you out everywhere and removes your name from the team list. Your past sales
                stay attributed for the business. Ask an administrator to re-invite you if you
                return.
              </p>
              <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                <UserMinus className="mr-2 h-4 w-4" aria-hidden />
                Delete my account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={closureOpen}
        onOpenChange={(open) => {
          setClosureOpen(open);
          if (!open) {
            setClosureStep(0);
            setClosurePassword("");
            setClosureConfirmName("");
            setClosureReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {closureStep === 0
                ? `Wait — are you sure about ${closure.organizationName}?`
                : closureStep === 1
                  ? "Help us understand (optional)"
                  : "Confirm business closure"}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                {closureStep === 0 ? (
                  <div className="space-y-3 text-sm">
                    <p>{statsLine}</p>
                    <p>
                      Closing puts your team in read-only mode immediately. After{" "}
                      {ACCOUNT_CLOSURE_GRACE_DAYS} days, every device is shut down and sign-in
                      stops.
                    </p>
                    <p className="font-medium">You can still:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Restore anytime before the deadline</li>
                      <li>Export catalogs and backups from Settings</li>
                      <li>Email support if something is blocking you</li>
                    </ul>
                  </div>
                ) : closureStep === 1 ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      If we can help you stay, choose a reason — or skip to continue.
                    </p>
                    <Select value={closureReason} onValueChange={setClosureReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLOSURE_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm">
                      Type your password and the exact business name to schedule closure.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="closure-password">Password</Label>
                      <PasswordInput
                        id="closure-password"
                        autoComplete="current-password"
                        value={closurePassword}
                        onChange={(event) => setClosurePassword(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="closure-confirm-name">
                        Business name:{" "}
                        <span className="font-semibold">{closure.organizationName}</span>
                      </Label>
                      <Input
                        id="closure-confirm-name"
                        value={closureConfirmName}
                        onChange={(event) => setClosureConfirmName(event.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={closurePending}
              onClick={() => {
                if (closureStep === 0) {
                  setClosureOpen(false);
                  return;
                }
                setClosureStep((step) => (step === 2 ? 1 : 0));
              }}
            >
              {closureStep === 0 ? "Keep my business" : "Go back"}
            </Button>
            <Button
              type="button"
              variant={closureStep === 2 ? "destructive" : "default"}
              disabled={
                closurePending ||
                (closureStep === 2 &&
                  (!closurePassword || closureConfirmName.trim() !== closure.organizationName))
              }
              onClick={() => {
                if (closureStep === 0) {
                  setClosureStep(1);
                  return;
                }
                if (closureStep === 1) {
                  setClosureStep(2);
                  return;
                }
                void onConfirmClosure();
              }}
            >
              {closureStep === 0
                ? "I still want to close"
                : closureStep === 1
                  ? "Continue"
                  : closurePending
                    ? "Scheduling…"
                    : "Schedule closure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeletePassword("");
        }}
        title="Delete your staff account?"
        description={
          <div className="space-y-3">
            <p className="text-sm">
              You will be signed out on every device. Your sales history stays with{" "}
              {closure.organizationName} for compliance.
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Confirm with your password</Label>
              <PasswordInput
                id="delete-password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </div>
          </div>
        }
        confirmLabel={deletePending ? "Removing…" : "Delete my account"}
        cancelLabel="Keep my account"
        disableConfirm={!deletePassword || deletePending}
        pending={deletePending}
        onConfirm={() => void onConfirmDeleteAccount()}
      />
    </div>
  );
}

function AlternativeRow({
  icon: Icon,
  title,
  description,
  href,
  actionLabel,
  external = false,
}: {
  icon: typeof PauseCircle;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  external?: boolean;
}) {
  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Icon className="text-primary h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      <Button type="button" variant="secondary" className="shrink-0" asChild>
        {external ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {actionLabel}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </a>
        ) : (
          <Link href={href}>
            {actionLabel}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        )}
      </Button>
    </div>
  );
}
