"use client";

import { FormEvent, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PlatformRole } from "@/convex/shared/platformRoles";
import { PageHeader } from "@/components/layout/primitives";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PasswordStrengthMeter } from "@/features/auth/components/password-strength";
import { PASSWORD_POLICY_MESSAGE, passwordMeetsPolicy } from "@/convex/shared/passwordPolicy";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useConnectivity } from "@/hooks/use-connectivity";
import { showError } from "@/lib/errors";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export function PlatformStaffView() {
  const online = useConnectivity();
  const session = useQuery(api.platform.me, online ? {} : "skip");
  const staff = useAuthedQuery(api.platform.listStaff, online ? {} : "skip");
  const createStaff = useAction(api.platform.createStaffAccount);
  const updateStaff = useMutation(api.platform.updateStaff);

  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PlatformRole>("operator");

  const canManage = session?.permissions?.includes("staff.manage") === true;
  const actorIsOwner = session?.role === "owner";

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!passwordMeetsPolicy(password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }
    setPending(true);
    try {
      await createStaff({ name, email, password, role });
      toast.success("Platform staff account created");
      setCreating(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("operator");
    } catch (error) {
      showError(error, "Could not create staff account");
    } finally {
      setPending(false);
    }
  }

  async function onRoleChange(adminId: Id<"platformAdmins">, next: PlatformRole) {
    try {
      await updateStaff({ adminId, role: next });
      toast.success("Role updated");
    } catch (error) {
      showError(error, "Could not update role");
    }
  }

  async function onStatusChange(adminId: Id<"platformAdmins">, status: "active" | "disabled") {
    try {
      await updateStaff({ adminId, status });
      toast.success(status === "active" ? "Access restored" : "Access disabled");
    } catch (error) {
      showError(error, "Could not update status");
    }
  }

  if (!online) {
    return (
      <EmptyState
        icon={Users}
        title="Connect to manage staff"
        description="Platform staff accounts require an online connection."
      />
    );
  }

  if (session === undefined || staff === undefined) {
    return <LoadingState label="Loading platform staff…" />;
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={Users}
        title="Staff management restricted"
        description="Only platform owners can create and edit sub-admins."
      />
    );
  }

  const roleOptions = (staff.roles ?? []).filter((row) => actorIsOwner || row.value !== "owner");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform staff"
        description="Create sub-admins with roles that limit which console areas they can use."
        actions={
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add staff
          </Button>
        }
      />

      {staff.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No platform staff yet"
          description="Add an operator, support, or analyst account."
        />
      ) : (
        <div className="grid gap-3">
          {staff.items.map((row) => {
            const isSelf = row.userId === session.userId;
            return (
              <Card key={row.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{row.name}</p>
                      <Badge variant={row.status === "active" ? "default" : "secondary"}>
                        {row.status}
                      </Badge>
                      {isSelf ? <Badge variant="outline">You</Badge> : null}
                    </div>
                    <p className="text-muted-foreground truncate text-sm">{row.email}</p>
                    <p className="text-muted-foreground text-xs">{row.roleLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={row.role}
                      onValueChange={(value) => onRoleChange(row.id, value as PlatformRole)}
                      disabled={isSelf && row.role === "owner"}
                    >
                      <SelectTrigger className="min-w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {row.status === "active" ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSelf}
                        onClick={() => onStatusChange(row.id, "disabled")}
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onStatusChange(row.id, "active")}
                      >
                        Enable
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add platform staff</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onCreate}>
            <div className="space-y-2">
              <Label htmlFor="staff-name">Name</Label>
              <Input
                id="staff-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-password">Temporary password</Label>
              <PasswordInput
                id="staff-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <PasswordStrengthMeter password={password} />
              <p className="text-muted-foreground text-xs">{PASSWORD_POLICY_MESSAGE}</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as PlatformRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col gap-0.5 py-1 text-left">
                        <span>{option.label}</span>
                        <span className="text-muted-foreground text-xs font-normal">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
