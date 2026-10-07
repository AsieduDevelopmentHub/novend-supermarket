"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { formatDateTime, formatPresence } from "@/lib/date";
import { ClockInLabel } from "@/features/users/components/clock-in-label";
import { deactivateAccountBlockReason } from "@/convex/shared/accountStatus";
import { showError } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useRemoteBudget } from "@/hooks/use-remote-budget";
import { useBranchesList } from "@/hooks/use-offline-lists";
import { listMirroredUsers } from "@/lib/offline/mirror-queries";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import type { AppRole } from "@/config/navigation";
import { ArrowLeft, KeyRound, Pencil, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { UserCommandCenter } from "./user-command-center";
import { EmptyState } from "@/components/feedback/empty-state";

export function UserDetailView({ profileId }: { profileId: Id<"profiles"> }) {
  const {
    canManageUsers,
    canDeactivateUsers,
    isAdmin,
    isManager,
    branchId: myBranchId,
    userId: actorUserId,
  } = usePermissions();
  const online = useConnectivity();
  const remote = useAuthedQuery(
    api.users.get,
    canManageUsers && online ? { id: profileId } : "skip",
  );
  const branches = useBranchesList(false);
  const [localUser, setLocalUser] = useState<
    Awaited<ReturnType<typeof listMirroredUsers>>[number] | null | undefined
  >(undefined);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listMirroredUsers().then((rows) => {
        if (cancelled) return;
        setLocalUser(rows.find((row) => row.id === profileId) ?? null);
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [profileId]);
  const remoteBudgetElapsed = useRemoteBudget(
    online && remote === undefined && localUser === undefined,
  );
  const user = remote ?? localUser;
  const updateProfile = useMutation(api.users.updateProfile);
  const resetUserPassword = useAction(api.users.resetUserPassword);

  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("cashier");
  const [branchId, setBranchId] = useState<Id<"branches"> | "">("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (!canManageUsers) {
    return <ErrorState message="You don’t have permission to view this user." />;
  }

  if (user === undefined) {
    if (!online || remoteBudgetElapsed) {
      return (
        <EmptyState
          title="User details need a connection"
          description="This profile isn’t available in the offline cache yet. Reconnect or open this user once while online."
        />
      );
    }
    return <LoadingState label="Loading user…" />;
  }

  if (!user) {
    return <ErrorState message="User not found." />;
  }

  const profile = user;
  const presence = formatPresence(profile);

  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const formBranchId = isManager ? (myBranchId ?? "") : branchId || profile.branchId || "";
  const roleOptions: AppRole[] = isAdmin ? ["administrator", "manager", "cashier"] : ["cashier"];
  const canToggleStatus =
    canDeactivateUsers && (isAdmin || (isManager && profile.role === "cashier"));
  const canResetPassword = isAdmin || (isManager && profile.role === "cashier");
  const deactivateBlocked =
    profile.status === "active" && actorUserId
      ? deactivateAccountBlockReason({
          actorUserId,
          targetUserId: profile.userId,
          ownerUserId: profile.isOwner ? profile.userId : null,
          presence: presence.online ? "online" : "offline",
        })
      : null;
  const canDisable = canToggleStatus && (profile.status !== "active" || !deactivateBlocked);

  function openEdit() {
    setName(profile.name);
    setRole(isManager ? "cashier" : (profile.role as AppRole));
    setBranchId((profile.branchId ?? myBranchId ?? "") as Id<"branches"> | "");
    setPhone(profile.phone ?? "");
    setStatus((profile.status === "inactive" ? "inactive" : "active") as "active" | "inactive");
    setEditOpen(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!formBranchId) {
      toast.error("Select a branch");
      return;
    }
    if (status === "inactive" && deactivateBlocked) {
      toast.error(deactivateBlocked);
      return;
    }
    setPending(true);
    try {
      await updateProfile({
        id: profileId,
        name,
        role: isManager ? "cashier" : role,
        branchId: formBranchId as Id<"branches">,
        phone: phone || undefined,
        status,
      });
      toast.success("User updated");
      setEditOpen(false);
    } catch (error) {
      showError(error, "Update failed");
    } finally {
      setPending(false);
    }
  }

  async function onToggleStatus() {
    if (!profile.branchId) {
      toast.error("This user has no branch assignment");
      return;
    }
    if (profile.status === "active" && deactivateBlocked) {
      toast.error(deactivateBlocked);
      return;
    }
    setPending(true);
    try {
      const nextStatus = profile.status === "active" ? "inactive" : "active";
      await updateProfile({
        id: profileId,
        name: profile.name,
        role: profile.role as AppRole,
        branchId: profile.branchId as Id<"branches">,
        phone: profile.phone ?? undefined,
        status: nextStatus,
      });
      toast.success(nextStatus === "active" ? "User reactivated" : "User deactivated");
      setStatusConfirm(false);
    } catch (error) {
      showError(error, "Could not update status");
    } finally {
      setPending(false);
    }
  }

  async function onResetPassword(event: FormEvent) {
    event.preventDefault();
    if (
      newPassword.length < 12 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      toast.error("Password must be 12+ characters with uppercase, lowercase, and a number");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPending(true);
    try {
      await resetUserPassword({ profileId, newPassword });
      toast.success(
        "Password reset. They’ll get a confirmation email — share the new password securely.",
      );
      setResetOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      showError(error, "Could not reset password");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.name}
        description={profile.email ?? "Team member profile"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/users">
                <ArrowLeft className="h-4 w-4" />
                Users
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            {canResetPassword ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewPassword("");
                  setConfirmPassword("");
                  setResetOpen(true);
                }}
              >
                <KeyRound className="h-4 w-4" />
                Reset password
              </Button>
            ) : null}
            {canToggleStatus && canDisable ? (
              <Button type="button" variant="outline" onClick={() => setStatusConfirm(true)}>
                {profile.status === "active" ? (
                  <>
                    <UserX className="h-4 w-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" />
                    Reactivate
                  </>
                )}
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <Avatar className="h-16 w-16 border">
              {profile.imageUrl ? <AvatarImage src={profile.imageUrl} alt="" /> : null}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-semibold">{profile.name}</p>
              <p className="text-muted-foreground text-xs">{profile.email ?? "No email"}</p>
            </div>
          </div>
          <Field label="Role" value={profile.role} capitalize />
          <Field label="Branch" value={profile.branch} />
          <Field label="Phone" value={profile.phone ?? "—"} />
          <div>
            <p className="text-muted-foreground">Account status</p>
            <Badge variant={profile.status === "active" ? "success" : "secondary"} className="mt-1">
              {profile.status === "active" ? "Active" : "Deactivated"}
            </Badge>
            {deactivateBlocked ? (
              <p className="text-muted-foreground mt-1 text-xs">{deactivateBlocked}</p>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground">Presence</p>
            <Badge variant={presence.online ? "success" : "secondary"} className="mt-1">
              {presence.online ? "Online" : "Offline"}
            </Badge>
            <p className="text-muted-foreground mt-1 text-xs">{presence.label}</p>
            <ClockInLabel clockedInAt={profile.clockedInAt} clockedInOn={profile.clockedInOn} />
          </div>
          <Field
            label="Last seen"
            value={
              profile.lastSeenAt && profile.lastSeenAt > 0
                ? formatDateTime(profile.lastSeenAt)
                : "—"
            }
          />
        </CardContent>
      </Card>

      <UserCommandCenter profileId={profileId} userId={profile.userId} userName={profile.name} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as AppRole)}
                disabled={isManager}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <SearchableSelect
                options={(branches ?? []).map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                  keywords: branch.code,
                }))}
                value={formBranchId || undefined}
                onValueChange={(v) => setBranchId(v as Id<"branches">)}
                disabled={isManager}
                placeholder="Select branch"
                searchPlaceholder="Search branches…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-phone">Phone</Label>
              <Input id="user-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive" disabled={Boolean(deactivateBlocked)}>
                    Deactivated
                  </SelectItem>
                </SelectContent>
              </Select>
              {deactivateBlocked ? (
                <p className="text-muted-foreground text-xs">{deactivateBlocked}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onResetPassword}>
            <p className="text-muted-foreground text-sm">
              Set a new password for {profile.name}. Their current sessions will be signed out.
            </p>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={12}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={12}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Reset password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={statusConfirm}
        onOpenChange={(open) => !open && setStatusConfirm(false)}
        title={profile.status === "active" ? "Deactivate this user?" : "Reactivate this user?"}
        description={
          profile.status === "active" ? (
            <div className="space-y-2">
              <p>
                Deactivating {profile.name} preserves their sales, orders, returns, expenses, and
                audit history. The account stays in the organization so reports keep the employee
                reference.
              </p>
              <p>
                {profile.name} will no longer be able to sign in. You can reactivate them later.
              </p>
            </div>
          ) : (
            <p>{profile.name} will be able to sign in again. Historical records stay attached.</p>
          )
        }
        confirmLabel={profile.status === "active" ? "Deactivate user" : "Reactivate user"}
        cancelLabel="Cancel"
        confirmVariant={profile.status === "active" ? "destructive" : "default"}
        pending={pending}
        onConfirm={onToggleStatus}
      />
    </div>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`mt-1 font-medium ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}
