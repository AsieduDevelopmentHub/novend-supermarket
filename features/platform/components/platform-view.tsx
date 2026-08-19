"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/date";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Building2, Eye, Plus } from "lucide-react";

export function PlatformView() {
  const orgs = useQuery(api.platform.listOrganizations, {});
  const setPlan = useMutation(api.platform.setOrganizationPlan);
  const createOrg = useAction(api.platform.createOrganization);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [currency, setCurrency] = useState("GHS");

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await createOrg({
        name,
        currency,
        adminName,
        adminEmail,
        adminPassword,
      });
      toast.success("Organization created");
      setOpen(false);
      setName("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
    } catch (error) {
      showError(error, "Could not create organization");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Create tenants, change plans, and open a business for support."
        actions={
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New organization
          </Button>
        }
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {orgs === undefined ? (
            <div className="p-6">
              <LoadingState label="Loading organizations…" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Building2} title="No organizations yet" />
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Sales</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <ClickableTableRow key={org.id} href={`/platform/${org.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{org.name}</p>
                      <p className="text-muted-foreground text-xs">{org.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={org.status === "active" ? "success" : "secondary"}
                      >
                        {org.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        defaultValue={org.plan}
                        className="h-8 w-28"
                        onBlur={(event) => {
                          const plan = event.target.value.trim();
                          if (plan && plan !== org.plan) {
                            void setPlan({ organizationId: org.id, plan }).catch((error) =>
                              showError(error, "Could not update plan"),
                            );
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">{org.userCount}</td>
                    <td className="px-4 py-3">{org.saleCount}</td>
                    <td className="px-4 py-3">{formatDateTime(org.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/platform/${org.id}`}>
                          <Eye className="h-4 w-4" />
                          Open
                        </Link>
                      </Button>
                    </td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => void onCreate(e)}>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-2">
                <Label>Business name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Admin name</Label>
                <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Admin email</Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Admin password</Label>
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
