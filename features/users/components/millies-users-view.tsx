"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePermissions } from "@/hooks/use-permissions";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import type { AppRole } from "@/config/navigation";
import {
  createLocalUser,
  listLocalUsers,
  readMilliesSession,
  resetLocalUserPassword,
  setLocalUserActive,
  type MilliesSessionUser,
} from "@/lib/offline/millies-auth";
import type { MilliesLocalRole } from "@/lib/offline/millies-auth-db";
import { bindOfflineOrganization, getOfflineDb } from "@/lib/offline/db";
import type { MirroredUser } from "@/lib/offline/types";

type LocalUserRow = {
  id: string;
  username: string;
  displayName: string;
  role: MilliesLocalRole;
  active: boolean;
  createdAt: number;
};

async function mirrorUserToReplica(user: {
  id: string;
  username: string;
  displayName: string;
  role: MilliesLocalRole;
  active: boolean;
}) {
  const session = readMilliesSession();
  if (!session) return;
  bindOfflineOrganization(session.organizationId);
  const db = await getOfflineDb();
  if (!db) return;
  const row: MirroredUser = {
    id: user.id,
    userId: user.id,
    name: user.displayName,
    role: user.role,
    branch: session.branchName,
    branchId: session.branchId,
    phone: null,
    status: user.active ? "active" : "inactive",
    email: user.username.includes("@") ? user.username : null,
    imageUrl: null,
    isOwner: user.role === "administrator",
    isSelf: user.id === session.id,
  };
  await db.users.put(row);
}

export function MilliesUsersView() {
  const { canManageUsers, isAdmin, isManager, userId: actorUserId } = usePermissions();
  const [rows, setRows] = useState<LocalUserRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("cashier");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function reload() {
    try {
      const list = await listLocalUsers();
      setRows(list);
    } catch (error) {
      showError(error, "Could not load staff");
      setRows([]);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  if (!canManageUsers) {
    return (
      <EmptyState
        title="Access required"
        description="User management is limited to administrators and branch managers."
      />
    );
  }

  if (!rows) {
    return <LoadingState label="Loading staff…" />;
  }

  const roleOptions: AppRole[] = isAdmin
    ? ["administrator", "manager", "cashier"]
    : ["cashier"];

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const created = await createLocalUser({
        username,
        displayName: name,
        password,
        role: role as MilliesLocalRole,
      });
      await mirrorUserToReplica({
        id: created.id,
        username: created.username,
        displayName: created.displayName,
        role: created.role,
        active: true,
      });
      toast.success("Staff account created");
      setCreating(false);
      setName("");
      setUsername("");
      setPassword("");
      setRole("cashier");
      await reload();
    } catch (error) {
      showError(error, "Could not create user");
    } finally {
      setPending(false);
    }
  }

  async function onToggleActive(row: LocalUserRow) {
    const actor = readMilliesSession() as MilliesSessionUser | null;
    if (!actor) return;
    setPending(true);
    try {
      await setLocalUserActive(row.id, !row.active, actor);
      await mirrorUserToReplica({
        ...row,
        active: !row.active,
      });
      toast.success(row.active ? "User deactivated" : "User activated");
      await reload();
    } catch (error) {
      showError(error, "Could not update user");
    } finally {
      setPending(false);
    }
  }

  async function onResetPassword(event: FormEvent) {
    event.preventDefault();
    if (!resetId) return;
    const actor = readMilliesSession() as MilliesSessionUser | null;
    if (!actor) return;
    setPending(true);
    try {
      await resetLocalUserPassword(resetId, newPassword, actor);
      toast.success("Password updated");
      setResetId(null);
      setNewPassword("");
    } catch (error) {
      showError(error, "Could not reset password");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Local accounts on this till. Passwords never leave the device."
        actions={
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add staff
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff yet"
          description="Create a cashier or manager account for this store."
        />
      ) : (
        <ul className="divide-border divide-y rounded-lg border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{row.displayName}</p>
                <p className="text-muted-foreground truncate text-sm">
                  @{row.username} · <span className="capitalize">{row.role}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.active ? "default" : "secondary"}>
                  {row.active ? "Active" : "Inactive"}
                </Badge>
                {row.id !== actorUserId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending || (isManager && row.role !== "cashier")}
                    onClick={() => void onToggleActive(row)}
                  >
                    {row.active ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || (isManager && row.role !== "cashier")}
                  onClick={() => {
                    setResetId(row.id);
                    setNewPassword("");
                  }}
                >
                  Reset password
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void onCreate(e)}>
            <div className="space-y-2">
              <Label htmlFor="staff-name">Display name</Label>
              <Input
                id="staff-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-username">Username</Label>
              <Input
                id="staff-username"
                required
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger id="staff-role">
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
              <Label htmlFor="staff-password">Password</Label>
              <PasswordInput
                id="staff-password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetId)} onOpenChange={(open) => !open && setResetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void onResetPassword(e)}>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New password</Label>
              <PasswordInput
                id="reset-password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Update password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
