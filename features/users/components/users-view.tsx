"use client";

import { FormEvent, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { PageHeader } from "@/components/layout/primitives";
import { PlanLimitNotice } from "@/features/billing/components/plan-limit-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBranchesList, useUsersList } from "@/hooks/use-offline-lists";
import { Eye, Pencil, Plus, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import {
  PASSWORD_POLICY_MESSAGE,
  passwordMeetsPolicy,
} from "@/convex/shared/passwordPolicy";
import { PasswordStrengthMeter } from "@/features/auth/components/password-strength";
import { formatPresence } from "@/lib/date";
import { ClockInLabel } from "@/features/users/components/clock-in-label";
import { notifyReplicaChanged } from "@/lib/offline/replica-events";
import { storeLocalAuthVerifier } from "@/lib/offline/local-auth";
import { rememberOfflineSession } from "@/lib/offline/session";
import { getBoundOrganizationId } from "@/lib/offline/db";
import { useOfflineSessionHint } from "@/hooks/use-offline-session-hint";
import { deactivateAccountBlockReason } from "@/convex/shared/accountStatus";
import type { AppRole } from "@/config/navigation";
import type { MilliesLocalRole } from "@/lib/offline/millies-auth-db";
import {
  milliesCreateStaff,
  milliesGetStaffPermissions,
  milliesUpdateStaff,
} from "@/lib/offline/millies-users";
import {
  permissionsForRole,
  type AppPermission,
} from "@/lib/offline/millies-permissions";
import { StaffPermissionsFields } from "./staff-permissions-fields";
import { StaffMonthRoster } from "./staff-month-roster";

function userInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UsersView() {
  const {
    canManageUsers,
    isAdmin,
    isManager,
    permissions: actorPermissions,
    branchId: myBranchId,
    userId: actorUserId,
  } = usePermissions();
  const online = useConnectivity();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<Id<"profiles"> | null>(null);
  const [creating, setCreating] = useState(false);
  const users = useUsersList(search, canManageUsers);
  const branches = useBranchesList(false);
  const updateProfile = useMutation(api.users.updateProfile);
  const createUserAccount = useAction(api.users.createUserAccount);
  const sessionHint = useOfflineSessionHint();

  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("cashier");
  const [staffPermissions, setStaffPermissions] = useState<AppPermission[]>(() =>
    permissionsForRole("cashier"),
  );
  const [branchId, setBranchId] = useState<Id<"branches"> | "">("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const grantablePermissions = isManager
    ? permissionsForRole("cashier")
    : actorPermissions;

  const formBranchId = isManager ? (myBranchId ?? "") : branchId || branches?.[0]?.id || "";
  const editingUser = users?.find((row) => row.id === editingId);
  const editingPresence = editingUser ? formatPresence(editingUser) : null;
  const deactivateBlocked =
    editingUser && editingUser.status === "active" && actorUserId
      ? deactivateAccountBlockReason({
          actorUserId,
          targetUserId: editingUser.userId,
          ownerUserId: editingUser.isOwner ? editingUser.userId : null,
          presence: editingPresence?.online ? "online" : "offline",
        })
      : null;

  if (!canManageUsers) {
    return (
      <EmptyState
        title="Access required"
        description="User management is limited to administrators and branch managers."
      />
    );
  }

  function openEdit(row: {
    id: Id<"profiles">;
    name: string;
    role: AppRole;
    branchId: Id<"branches"> | null;
    phone: string | null;
    status: "active" | "inactive";
  }) {
    const nextRole = (isManager ? "cashier" : row.role) as MilliesLocalRole;
    setEditingId(row.id);
    setName(row.name);
    setRole(nextRole);
    setStaffPermissions(permissionsForRole(nextRole));
    setBranchId((row.branchId ?? myBranchId ?? "") as Id<"branches"> | "");
    setPhone(row.phone ?? "");
    setStatus(row.status === "inactive" ? "inactive" : "active");
    if (FULLY_OFFLINE) {
      void milliesGetStaffPermissions(String(row.id)).then((perms) => {
        setStaffPermissions(perms);
      });
    }
  }

  function openCreate() {
    setCreating(true);
    setName("");
    setEmail("");
    setPassword("");
    setRole("cashier");
    setStaffPermissions(permissionsForRole("cashier"));
    setBranchId(
      (isManager ? (myBranchId ?? "") : (branches?.[0]?.id ?? "")) as Id<"branches"> | "",
    );
    setPhone("");
  }

  function onRoleChange(next: AppRole) {
    setRole(next);
    setStaffPermissions(permissionsForRole(next as MilliesLocalRole));
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!editingId || !formBranchId) {
      toast.error("Select a branch");
      return;
    }
    if (status === "inactive" && deactivateBlocked) {
      toast.error(deactivateBlocked);
      return;
    }
    setPending(true);
    try {
      const nextRole = (isManager ? "cashier" : role) as MilliesLocalRole;
      if (FULLY_OFFLINE) {
        await milliesUpdateStaff({
          id: String(editingId),
          displayName: name,
          role: nextRole,
          permissions: staffPermissions,
          phone: phone || undefined,
          active: status === "active",
        });
      } else {
        await updateProfile({
          id: editingId,
          name,
          role: nextRole,
          branchId: formBranchId as Id<"branches">,
          phone: phone || undefined,
          status,
        });
      }
      toast.success("User updated");
      setEditingId(null);
    } catch (error) {
      showError(error, "Update failed");
    } finally {
      setPending(false);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!FULLY_OFFLINE && !online) {
      toast.error("Connect to the internet to create user accounts.");
      return;
    }
    if (!formBranchId) {
      toast.error("Select a branch");
      return;
    }
    if (!FULLY_OFFLINE && !passwordMeetsPolicy(password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (FULLY_OFFLINE && password.trim().length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const usernameOrEmail = email.trim();
    if (!usernameOrEmail) {
      toast.error(FULLY_OFFLINE ? "Username is required" : "Email is required");
      return;
    }
    setPending(true);
    try {
      const createdRole = (isManager ? "cashier" : role) as MilliesLocalRole;
      if (FULLY_OFFLINE) {
        await milliesCreateStaff({
          username: usernameOrEmail,
          displayName: name,
          password,
          role: createdRole,
          permissions: staffPermissions,
          phone: phone || undefined,
        });
        toast.success("Staff account created on this till. Share the username and password.");
        setCreating(false);
        setPassword("");
        return;
      }
      // Online-only: never queue plaintext passwords into the Dexie outbox.
      const created = await createUserAccount({
        email: usernameOrEmail,
        password,
        name,
        role: createdRole,
        branchId: formBranchId as Id<"branches">,
        phone: phone || undefined,
      });
      const organizationId = getBoundOrganizationId() ?? sessionHint?.organizationId ?? null;
      const branchName =
        branches?.find((branch) => branch.id === formBranchId)?.name ?? "Branch";
      const verifierSaved = Boolean(
        created?.userId &&
          (await storeLocalAuthVerifier(usernameOrEmail, password, created.userId)),
      );
      const offlineReady = Boolean(verifierSaved && created?.userId && organizationId);
      if (offlineReady && created?.userId && organizationId) {
        rememberOfflineSession({
          userId: created.userId,
          name: name.trim(),
          role: createdRole,
          branchId: String(formBranchId),
          branchName,
          organizationId,
          email: usernameOrEmail.toLowerCase(),
          savedAt: Date.now(),
        });
      }
      notifyReplicaChanged({ pull: true });
      toast.success(
        offlineReady
          ? "User created. They can sign in on this till offline with that password."
          : "User created. Share the login credentials securely.",
      );
      setCreating(false);
      setPassword("");
    } catch (error) {
      showError(error, "Could not create user");
    } finally {
      setPending(false);
    }
  }

  const roleOptions: AppRole[] = isAdmin ? ["administrator", "manager", "cashier"] : ["cashier"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={
          isManager
            ? "Manage cashiers assigned to your branch."
            : "Create accounts and monitor who is online."
        }
        compactActions={[{ key: "add", label: "Add User", icon: Plus, onClick: openCreate }]}
        actions={
          <Button type="button" data-tour="users-add" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        }
      />

      {!FULLY_OFFLINE ? <PlanLimitNotice resource="users" /> : null}

      <StaffMonthRoster />

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users…"
        className="max-w-md"
      />

      <Card data-tour="users-list">
        <CardContent className="overflow-x-auto p-0">
          {users === undefined ? (
            <div className="p-6">
              <LoadingState label="Loading users…" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Users} title="No users found" />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Branch</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">Presence</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <ClickableTableRow key={user.id} href={`/users/${user.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border">
                              {user.imageUrl ? <AvatarImage src={user.imageUrl} alt="" /> : null}
                              <AvatarFallback>{userInitials(user.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-muted-foreground text-xs">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize">{user.role}</td>
                        <td className="px-4 py-3">{user.branch}</td>
                        <td className="px-4 py-3">{user.phone ?? "—"}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const presence = formatPresence(user);
                            return (
                              <div>
                                <Badge variant={presence.online ? "success" : "secondary"}>
                                  {presence.online ? "Online" : "Offline"}
                                </Badge>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  {presence.label}
                                </p>
                                <ClockInLabel
                                  clockedInAt={user.clockedInAt}
                                  clockedInOn={user.clockedInOn}
                                />
                                {user.lastDevice ? (
                                  <p className="text-muted-foreground text-xs">{user.lastDevice}</p>
                                ) : null}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.status === "active" ? "success" : "secondary"}>
                            {user.status === "active" ? "Active" : "Deactivated"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              aria-label="View user details"
                            >
                              <Link href={`/users/${user.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Edit user"
                              onClick={() =>
                                openEdit({
                                  id: user.id,
                                  name: user.name,
                                  role: user.role as AppRole,
                                  branchId: user.branchId,
                                  phone: user.phone,
                                  status: user.status,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {users.map((user) => (
                  <div key={user.id} className="border-border space-y-2 rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/users/${user.id}`}
                        className="flex min-w-0 items-center gap-3 font-medium hover:underline"
                      >
                        <Avatar className="h-9 w-9 border">
                          {user.imageUrl ? <AvatarImage src={user.imageUrl} alt="" /> : null}
                          <AvatarFallback>{userInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{user.name}</span>
                      </Link>
                      <div className="flex flex-col items-end gap-1">
                        {(() => {
                          const presence = formatPresence(user);
                          return (
                            <>
                              <Badge variant={presence.online ? "success" : "secondary"}>
                                {presence.online ? "Online" : "Offline"}
                              </Badge>
                              <p className="text-muted-foreground text-xs">{presence.label}</p>
                              <ClockInLabel
                                clockedInAt={user.clockedInAt}
                                clockedInOn={user.clockedInOn}
                              />
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs capitalize">
                      {user.role} · {user.branch}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/users/${user.id}`}>
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openEdit({
                            id: user.id,
                            name: user.name,
                            role: user.role as AppRole,
                            branchId: user.branchId,
                            phone: user.phone,
                            status: user.status,
                          })
                        }
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => onRoleChange(v as AppRole)}
                disabled={isManager}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {FULLY_OFFLINE ? (
              <StaffPermissionsFields
                role={role as MilliesLocalRole}
                value={staffPermissions}
                onChange={setStaffPermissions}
                grantable={grantablePermissions}
                disabled={pending}
              />
            ) : null}
            <div className="space-y-2">
              <Label>Branch</Label>
              <SearchableSelect
                options={(branches ?? []).map((b) => ({
                  value: b.id,
                  label: b.name,
                  keywords: b.code,
                }))}
                value={formBranchId || undefined}
                onValueChange={(v) => setBranchId(v as Id<"branches">)}
                disabled={isManager}
                placeholder={branches === undefined ? "Loading branches…" : "Select branch"}
                searchPlaceholder="Search branches…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onCreate}>
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">{FULLY_OFFLINE ? "Username" : "Email"}</Label>
              <Input
                id="create-email"
                type={FULLY_OFFLINE ? "text" : "email"}
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Temporary password</Label>
              <PasswordInput
                id="create-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={FULLY_OFFLINE ? 6 : 12}
                autoComplete="new-password"
              />
              {!FULLY_OFFLINE ? <PasswordStrengthMeter password={password} compact /> : null}
              <p className="text-muted-foreground text-xs">
                Share this password securely. The employee signs in on /login — no self-signup.
                {FULLY_OFFLINE
                  ? " Accounts stay on this till only."
                  : " Creating accounts requires an internet connection."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => onRoleChange(v as AppRole)}
                disabled={isManager}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {FULLY_OFFLINE ? (
              <StaffPermissionsFields
                role={role as MilliesLocalRole}
                value={staffPermissions}
                onChange={setStaffPermissions}
                grantable={grantablePermissions}
                disabled={pending}
              />
            ) : null}
            <div className="space-y-2">
              <Label>Branch</Label>
              <SearchableSelect
                options={(branches ?? []).map((b) => ({
                  value: b.id,
                  label: b.name,
                  keywords: b.code,
                }))}
                value={formBranchId || undefined}
                onValueChange={(v) => setBranchId(v as Id<"branches">)}
                disabled={isManager}
                placeholder={branches === undefined ? "Loading branches…" : "Select branch"}
                searchPlaceholder="Search branches…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone</Label>
              <Input id="create-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
