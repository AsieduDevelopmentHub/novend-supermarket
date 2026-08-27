"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
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
import { formatNumber } from "@/lib/currency";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { Checkbox } from "@/components/ui/checkbox";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Building2, Eye, Plus } from "lucide-react";
import { PLAN_LIST, type PlanKey } from "@/convex/shared/plans";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformOrganizationsData } from "@/hooks/use-platform-offline-data";

export function PlatformView() {
  const online = useConnectivity();
  const { data: orgs, loading } = usePlatformOrganizationsData();
  const createOrg = useAction(api.platform.createOrganization);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [trial, setTrial] = useState(true);
  const [planKey, setPlanKey] = useState<PlanKey>("pro");

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!online) {
      toast.error("Creating an organization requires a connection");
      return;
    }
    setPending(true);
    try {
      await createOrg({
        name,
        currency,
        adminName,
        adminEmail,
        adminPassword,
        trial,
        planKey,
      });
      toast.success(trial ? "Organization created on a Pro trial" : "Organization created");
      setOpen(false);
      setName("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setTrial(true);
      setPlanKey("pro");
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
          <Button type="button" onClick={() => setOpen(true)} disabled={!online}>
            <Plus className="h-4 w-4" />
            New organization
          </Button>
        }
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing cached organizations while offline. Creating tenants requires a connection.
        </p>
      ) : null}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading || orgs == null ? (
            <div className="p-6">
              <LoadingState label="Loading organizations…" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Building2} title="No organizations yet" />
            </div>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Sales</th>
                  <th className="px-4 py-3 font-medium">Import</th>
                  <th className="px-4 py-3 font-medium">Export</th>
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
                      <Badge variant={org.status === "active" ? "success" : "secondary"}>
                        {org.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{org.plan}</td>
                    <td className="px-4 py-3">{org.userCount}</td>
                    <td className="px-4 py-3">{org.saleCount}</td>
                    <td className="px-4 py-3">
                      <p>
                        {formatNumber(org.importJobCount ?? 0)}
                        {(org.failedImportCount ?? 0) > 0
                          ? ` · ${formatNumber(org.failedImportCount ?? 0)} failed`
                          : ""}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {org.maxImportRows != null
                          ? `${formatNumber(org.maxImportRows)} row cap`
                          : "—"}
                        {org.productLimitOverridden ? " · override" : ""}
                        {org.productsUsed != null
                          ? ` · ${formatNumber(org.productsUsed)}${
                              org.productLimit == null ? "" : ` / ${formatNumber(org.productLimit)}`
                            } products`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{formatNumber(org.exportEventCount ?? 0)}</p>
                      <p className="text-muted-foreground text-xs">
                        {org.canExportXlsx ? "Excel + PDF" : "CSV / JSON"}
                      </p>
                    </td>
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
              <div className="space-y-2">
                <Label htmlFor="platform-plan">Starting plan</Label>
                <select
                  id="platform-plan"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={planKey}
                  onChange={(event) => setPlanKey(event.target.value as PlanKey)}
                >
                  {PLAN_LIST.map((plan) => (
                    <option key={plan.key} value={plan.key}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={trial}
                  onCheckedChange={(value) => setTrial(value === true)}
                  aria-label="Start on a 14-day trial"
                />
                <span>Start on a 14-day trial</span>
              </label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || !online}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
