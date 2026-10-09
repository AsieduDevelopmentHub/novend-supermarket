"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatDateTime, formatPresence } from "@/lib/date";
import { formatPlanBytes } from "@/convex/shared/plans";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ArrowLeft, Pencil, ShieldAlert } from "lucide-react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformOrgDetailData } from "@/hooks/use-platform-offline-data";
import { PlatformLicensePanel } from "./platform-license-panel";
import { PlatformImportExportCard } from "./platform-import-export-card";
import { PlatformExperiencePanel } from "./platform-experience-panel";
import { PlatformEntitlementsPanel } from "./platform-entitlements-panel";
import { PlatformCommercialPanel } from "./platform-commercial-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatClosureReason } from "@/convex/shared/accountClosure";

const ORG_DETAIL_TABS = [
  "overview",
  "licence",
  "experience",
  "entitlements",
  "commercial",
  "team",
  "analytics",
] as const;

export function PlatformOrgDetailView({ organizationId }: { organizationId: string }) {
  const id = organizationId as Id<"organizations">;
  const online = useConnectivity();
  const { data: org, loading } = usePlatformOrgDetailData(organizationId);
  const requestedTab = useSearchParams().get("tab");
  const initialTab = ORG_DETAIL_TABS.includes(
    (requestedTab ?? "") as (typeof ORG_DETAIL_TABS)[number],
  )
    ? (requestedTab as string)
    : "overview";
  const resetPassword = useAction(api.platform.resetOrganizationAdminPassword);
  const updateProfile = useMutation(api.platform.updateOrganizationProfile);
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileCountry, setProfileCountry] = useState("");
  const [profileTimezone, setProfileTimezone] = useState("");
  const [profileTaxId, setProfileTaxId] = useState("");
  const [profilePending, setProfilePending] = useState(false);

  function openEditProfile() {
    if (!org) return;
    setProfileCountry(org.country ?? "");
    setProfileTimezone(org.timezone ?? "");
    setProfileTaxId(org.taxId ?? "");
    setEditProfileOpen(true);
  }

  if (loading || org === undefined) {
    return <LoadingState label="Loading organization…" />;
  }
  if (!org) {
    return <ErrorState message="Organization not found." />;
  }

  async function onSaveProfile() {
    setProfilePending(true);
    try {
      await updateProfile({
        organizationId: id,
        country: profileCountry.trim() || undefined,
        timezone: profileTimezone.trim() || undefined,
        taxId: profileTaxId.trim() || undefined,
      });
      toast.success("Organization profile updated");
      setEditProfileOpen(false);
    } catch (error) {
      showError(error, "Update failed");
    } finally {
      setProfilePending(false);
    }
  }

  async function onReset() {
    if (!online) {
      toast.error("Password reset requires a connection");
      return;
    }
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
      <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-10 -mx-1 border-b px-1 py-3 backdrop-blur">
        <PageHeader
          title={org.name}
          description={`${org.slug} · ${org.currency} · created ${formatDateTime(org.createdAt)}`}
          actions={
            <Button asChild variant="outline">
              <Link href="/platform/organizations">
                <ArrowLeft className="h-4 w-4" />
                Organizations
              </Link>
            </Button>
          }
        />
      </div>

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing cached organization details. Licence changes require a connection.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={org.status === "active" ? "success" : "secondary"}>{org.status}</Badge>
        {org.isTestOrganization ? <Badge variant="outline">Test organization</Badge> : null}
        {org.pendingClosure && org.closureEffectiveAt ? (
          <Badge variant="destructive">Closure {formatDateTime(org.closureEffectiveAt)}</Badge>
        ) : null}
        <Badge variant="outline">{org.plan}</Badge>
        <Badge variant="outline">{org.industryLabel ?? "Retail"}</Badge>
      </div>

      {org.pendingClosure && org.closureEffectiveAt ? (
        <Alert className="border-destructive/40 bg-destructive/5">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          <AlertTitle>Owner scheduled business closure</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              This organization is read-only until permanent closure on{" "}
              <strong>{formatDateTime(org.closureEffectiveAt)}</strong>
              {org.closureRequestedAt
                ? ` (requested ${formatDateTime(org.closureRequestedAt)})`
                : null}
              .
            </p>
            {org.closureReason ? (
              <p>Reason: {formatClosureReason(org.closureReason) ?? org.closureReason}</p>
            ) : null}
            <p className="text-muted-foreground text-sm">
              The owner can still undo this from Settings → Privacy &amp; data. You can archive
              immediately from the Licence tab if intervention is required.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="licence">Licence</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Grid cols={5}>
            <Kpi title="Revenue (30d)" value={formatCurrency(org.kpis.revenue30d)} />
            <Kpi title="Revenue (all)" value={formatCurrency(org.kpis.revenueAll)} />
            <Kpi title="Sales" value={String(org.kpis.saleCount)} />
            <Kpi title="Users" value={String(org.kpis.userCount)} />
            <Kpi title="Wholesale value" value={formatCurrency(org.kpis.wholesaleValue)} />
          </Grid>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Organization details</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!online}
                onClick={openEditProfile}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Business name" value={org.name} />
              <Info label="Organization ID" value={org.id} mono />
              <Info label="Business type" value={org.industryLabel ?? "Retail"} />
              <Info label="Owner" value={org.owner.name || "—"} />
              <Info label="Email" value={org.business.email || org.owner.email || "—"} />
              <Info label="Phone" value={org.business.phone || "—"} />
              <Info label="Country" value={org.country || "—"} />
              <Info label="Created" value={formatDateTime(org.createdAt)} />
              <Info
                label="Last active"
                value={org.kpis.lastActiveAt ? formatDateTime(org.kpis.lastActiveAt) : "Never"}
              />
              <Info label="Subscription status" value={org.status} className="capitalize" />
              {org.pendingClosure && org.closureEffectiveAt ? (
                <>
                  <Info label="Closure effective" value={formatDateTime(org.closureEffectiveAt)} />
                  <Info
                    label="Closure reason"
                    value={formatClosureReason(org.closureReason) ?? "Not provided"}
                  />
                </>
              ) : null}
              <Info label="Timezone" value={org.timezone || "—"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Trade name" value={org.business.tradeName} />
              <Info label="Legal name" value={org.business.legalName} />
              <Info label="Business type" value={org.industryLabel ?? "Retail"} />
              <Info label="Address" value={org.business.address || "—"} />
              <Info label="Tax ID" value={org.taxId || org.business.taxId || "—"} />
              <Info
                label="Last sale"
                value={org.kpis.lastSaleAt ? formatDateTime(org.kpis.lastSaleAt) : "None yet"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branches</CardTitle>
            </CardHeader>
            <CardContent>
              {org.branches.length === 0 ? (
                <EmptyState title="No branches" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[360px] text-left text-sm">
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
                </div>
              )}
            </CardContent>
          </Card>

          <PlatformImportExportCard snapshot={org.importExport} />
        </TabsContent>

        <TabsContent value="licence">
          <PlatformLicensePanel
            organizationId={id}
            organizationName={org.name}
            status={org.status}
            limitOverrides={org.limitOverrides}
            productImagesEnabled={org.productImagesEnabled}
            importExport={org.importExport}
            pendingClosure={org.pendingClosure}
            closureEffectiveAt={org.closureEffectiveAt}
            closureReason={org.closureReason}
          />
        </TabsContent>

        <TabsContent value="experience">
          <PlatformExperiencePanel organizationId={id} />
        </TabsContent>

        <TabsContent value="entitlements">
          <PlatformEntitlementsPanel organizationId={id} />
        </TabsContent>

        <TabsContent value="commercial">
          <PlatformCommercialPanel organizationId={id} currency={org.currency} />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Owner & team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Owner name" value={org.owner.name || "—"} />
                <Info label="Owner email" value={org.owner.email || "—"} />
                <Info label="Admins" value={String(org.kpis.adminCount)} />
                <Info
                  label="Managers / cashiers"
                  value={`${org.kpis.managerCount} / ${org.kpis.cashierCount}`}
                />
                <Info label="Branches" value={String(org.kpis.branchCount)} />
                <Info label="Products" value={String(org.kpis.productCount)} />
                <Info label="Suppliers" value={String(org.kpis.supplierCount)} />
                <Info label="Wholesale units" value={String(org.kpis.wholesaleUnits)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resetPassword">Reset owner password</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="resetPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || !online}
                    onClick={() => void onReset()}
                  >
                    Reset
                  </Button>
                </div>
              </div>
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
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Grid cols={4}>
            <Kpi title="Orders" value={formatNumber(org.kpis.saleCount)} />
            <Kpi title="Revenue (all)" value={formatCurrency(org.kpis.revenueAll)} />
            <Kpi title="Customers" value={formatNumber(org.kpis.customerCount)} />
            <Kpi title="Active users" value={formatNumber(org.kpis.userCount)} />
          </Grid>
          <Grid cols={4}>
            <Kpi title="Products" value={formatNumber(org.kpis.productCount)} />
            <Kpi title="Branches" value={formatNumber(org.kpis.branchCount)} />
            <Kpi
              title="Storage used"
              value={formatPlanBytes(org.kpis.storageBytes)}
              hint={`${(org.kpis.storageBytes / 1024 / 1024).toFixed(1)} MB`}
            />
            <Kpi
              title="Devices"
              value={String(org.kpis.deviceCount)}
              hint={`${org.kpis.deviceCountTotal} registered total`}
            />
          </Grid>
          <Grid cols={2}>
            <Kpi
              title="Import row cap"
              value={org.importExport ? formatNumber(org.importExport.maxImportRows) : "—"}
              hint={
                org.importExport?.productLimitOverridden
                  ? "From the product override"
                  : "From the product limit"
              }
            />
            <Kpi
              title="Imports / exports"
              value={
                org.importExport
                  ? `${formatNumber(org.importExport.importJobs)} / ${formatNumber(org.importExport.exportEvents)}`
                  : "—"
              }
            />
          </Grid>
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Info
                label="Last sale"
                value={org.kpis.lastSaleAt ? formatDateTime(org.kpis.lastSaleAt) : "None yet"}
              />
              <Info
                label="Last sync"
                value={org.kpis.lastSyncAt ? formatDateTime(org.kpis.lastSyncAt) : "Never"}
              />
              <Info label="Revenue (30d)" value={formatCurrency(org.kpis.revenue30d)} />
              <Info label="Wholesale value" value={formatCurrency(org.kpis.wholesaleValue)} />
              <Info label="Wholesale units" value={String(org.kpis.wholesaleUnits)} />
              <Info label="Suppliers" value={String(org.kpis.supplierCount)} />
              <Info label="Admins" value={String(org.kpis.adminCount)} />
              <Info
                label="Managers / cashiers"
                value={`${org.kpis.managerCount} / ${org.kpis.cashierCount}`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit organization profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="org-country">Country</Label>
              <Input
                id="org-country"
                value={profileCountry}
                onChange={(event) => setProfileCountry(event.target.value)}
                placeholder="e.g. Ghana"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-timezone">Timezone</Label>
              <Input
                id="org-timezone"
                value={profileTimezone}
                onChange={(event) => setProfileTimezone(event.target.value)}
                placeholder="e.g. Africa/Accra"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-taxid">Tax ID</Label>
              <Input
                id="org-taxid"
                value={profileTaxId}
                onChange={(event) => setProfileTaxId(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={profilePending} onClick={() => void onSaveProfile()}>
              {profilePending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn("mt-1 font-medium break-words", mono && "font-mono text-xs", className)}>
        {value}
      </p>
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="min-w-0 p-5">
        <p className="text-muted-foreground text-sm">{title}</p>
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
