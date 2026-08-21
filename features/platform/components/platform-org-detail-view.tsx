"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, formatPresence } from "@/lib/date";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ArrowLeft } from "lucide-react";
import { PlatformLicensePanel } from "./platform-license-panel";

export function PlatformOrgDetailView({ organizationId }: { organizationId: string }) {
  const id = organizationId as Id<"organizations">;
  const org = useQuery(api.platform.getOrganization, { organizationId: id });
  const resetPassword = useAction(api.platform.resetOrganizationAdminPassword);
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);

  if (org === undefined) {
    return <LoadingState label="Loading organization…" />;
  }
  if (!org) {
    return <ErrorState message="Organization not found." />;
  }

  async function onReset() {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPending(true);
    try {
      await resetPassword({ organizationId: id, newPassword });
      toast.success("Owner password reset");
      setNewPassword("");
    } catch (error) {
      showError(error, "Reset failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        description={`${org.slug} · ${org.currency} · created ${formatDateTime(org.createdAt)}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/platform">
              <ArrowLeft className="h-4 w-4" />
              All organizations
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={org.status === "active" ? "success" : "secondary"}>{org.status}</Badge>
        <Badge variant="outline">{org.plan}</Badge>
      </div>

      <Grid cols={5}>
        <Kpi title="Revenue (30d)" value={formatCurrency(org.kpis.revenue30d)} />
        <Kpi title="Revenue (all)" value={formatCurrency(org.kpis.revenueAll)} />
        <Kpi title="Sales" value={String(org.kpis.saleCount)} />
        <Kpi title="Users" value={String(org.kpis.userCount)} />
        <Kpi title="Wholesale value" value={formatCurrency(org.kpis.wholesaleValue)} />
      </Grid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Trade name" value={org.business.tradeName} />
            <Info label="Legal name" value={org.business.legalName} />
            <Info label="Phone" value={org.business.phone || "—"} />
            <Info label="Email" value={org.business.email || "—"} />
            <Info label="Address" value={org.business.address || "—"} />
            <Info label="Tax ID" value={org.taxId || org.business.taxId || "—"} />
            <Info label="Timezone" value={org.timezone || "—"} />
            <Info
              label="Last sale"
              value={org.kpis.lastSaleAt ? formatDateTime(org.kpis.lastSaleAt) : "None yet"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner & team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Owner name" value={org.owner.name || "—"} />
              <Info label="Owner email" value={org.owner.email || "—"} />
              <Info label="Admins" value={String(org.kpis.adminCount)} />
              <Info label="Managers / cashiers" value={`${org.kpis.managerCount} / ${org.kpis.cashierCount}`} />
              <Info label="Branches" value={String(org.kpis.branchCount)} />
              <Info label="Products" value={String(org.kpis.productCount)} />
              <Info label="Suppliers" value={String(org.kpis.supplierCount)} />
              <Info
                label="Wholesale units"
                value={String(org.kpis.wholesaleUnits)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resetPassword">Reset owner password</Label>
              <div className="flex gap-2">
                <Input
                  id="resetPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  minLength={8}
                />
                <Button type="button" variant="outline" disabled={pending} onClick={() => void onReset()}>
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PlatformLicensePanel organizationId={id} status={org.status} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
          </CardHeader>
          <CardContent>
            {org.branches.length === 0 ? (
              <EmptyState title="No branches" />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {org.branches.map((branch) => (
                    <tr key={branch.id} className="border-border border-t">
                      <td className="py-2 font-medium">{branch.name}</td>
                      <td className="py-2">{branch.code}</td>
                      <td className="py-2 capitalize">{branch.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {org.users.length === 0 ? (
              <EmptyState title="No users" />
            ) : (
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Branch</th>
                    <th className="pb-2 font-medium">Presence</th>
                  </tr>
                </thead>
                <tbody>
                  {org.users.map((person) => {
                    const presence = formatPresence({
                      lastSeenAt: person.lastSeenAt,
                      lastLoginAt: person.lastLoginAt,
                    });
                    return (
                      <tr key={person.id} className="border-border border-t">
                        <td className="py-2">
                          <p className="font-medium">{person.name}</p>
                          <p className="text-muted-foreground text-xs">{person.email ?? "—"}</p>
                        </td>
                        <td className="py-2 capitalize">{person.role}</td>
                        <td className="py-2">{person.branchName ?? "—"}</td>
                        <td className="py-2">
                          <Badge variant={presence.online ? "success" : "secondary"}>
                            {presence.online ? "Online" : "Offline"}
                          </Badge>
                          <p className="text-muted-foreground mt-1 text-xs">{presence.label}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-medium break-words">{value}</p>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="min-w-0 p-5">
        <p className="text-muted-foreground text-sm">{title}</p>
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
