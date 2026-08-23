"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { PlanLimitNotice } from "@/features/billing/components/plan-limit-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { usePermissions } from "@/hooks/use-permissions";
import { useBranchesList } from "@/hooks/use-offline-lists";
import { Building2, Eye, Pencil, Plus } from "lucide-react";
import { persistBusinessWrite, queuedSaveMessage, queueUpsertBranch } from "@/lib/offline/replica-writes";
import { useConnectivity } from "@/hooks/use-connectivity";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

export function BranchesView() {
  const { canManageBranches } = usePermissions();
  const branches = useBranchesList(true);
  const online = useConnectivity();
  const createBranch = useMutation(api.branches.create);
  const updateBranch = useMutation(api.branches.update);

  const [editingId, setEditingId] = useState<Id<"branches"> | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [pending, setPending] = useState(false);

  if (!canManageBranches) {
    return (
      <EmptyState
        title="Admin access required"
        description="Branch management is administrator-only."
      />
    );
  }

  function resetForm() {
    setName("");
    setCode("");
    setAddress("");
    setPhone("");
    setStatus("active");
  }

  function openCreate() {
    resetForm();
    setCreating(true);
  }

  function openEdit(row: {
    id: Id<"branches">;
    name: string;
    code: string;
    address?: string | null;
    phone?: string | null;
    status: "active" | "inactive";
  }) {
    setEditingId(row.id);
    setName(row.name);
    setCode(row.code);
    setAddress(row.address ?? "");
    setPhone(row.phone ?? "");
    setStatus(row.status);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          createBranch({
            name,
            code,
            address: address || undefined,
            phone: phone || undefined,
          }),
        local: () =>
          queueUpsertBranch({
            name,
            code,
            address: address || undefined,
            phone: phone || undefined,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Branch created"));
      setCreating(false);
      resetForm();
    } catch (error) {
      showError(error, "Could not create branch");
    } finally {
      setPending(false);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    setPending(true);
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          updateBranch({
            id: editingId,
            name,
            code,
            address: address || undefined,
            phone: phone || undefined,
            status,
          }),
        local: () =>
          queueUpsertBranch({
            serverId: editingId,
            name,
            code,
            address: address || undefined,
            phone: phone || undefined,
            status,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Branch updated"));
      setEditingId(null);
    } catch (error) {
      showError(error, "Update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Manage store locations and codes used for stock and sales."
        compactActions={[
          { key: "add", label: "Add branch", icon: Plus, onClick: openCreate },
        ]}
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add branch
          </Button>
        }
      />

      <PlanLimitNotice resource="branches" />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {branches === undefined ? (
            <div className="p-6">
              <LoadingState label="Loading branches…" />
            </div>
          ) : branches.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Building2}
                title="No branches yet"
                description="Create the first branch to assign stock and staff."
              />
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <ClickableTableRow key={branch.id} href={`/branches/${branch.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{branch.name}</p>
                      {branch.address ? (
                        <p className="text-muted-foreground text-xs">{branch.address}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{branch.code}</td>
                    <td className="px-4 py-3">{branch.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={branch.status === "active" ? "success" : "secondary"}>
                        {branch.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button asChild size="icon" variant="ghost" aria-label="View branch">
                          <Link href={`/branches/${branch.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Edit branch"
                          onClick={() => openEdit(branch)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add branch</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onCreate}>
            <div className="space-y-2">
              <Label htmlFor="branch-name">Name</Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-code">Code</Label>
              <Input
                id="branch-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. MAIN"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address">Address</Label>
              <Input
                id="branch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-phone">Phone</Label>
              <Input id="branch-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit branch</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSave}>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-name">Name</Label>
              <Input
                id="edit-branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-code">Code</Label>
              <Input
                id="edit-branch-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-address">Address</Label>
              <Input
                id="edit-branch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-phone">Phone</Label>
              <Input
                id="edit-branch-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
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
    </div>
  );
}
