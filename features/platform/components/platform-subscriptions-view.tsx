"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { CreditCard, Eye, FileText, MoreVertical, Pencil, ShieldOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatPlanBytes } from "@/convex/shared/plans";
import { showError } from "@/lib/errors";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformSubscriptionsData } from "@/hooks/use-platform-offline-data";

type SubscriptionRow = NonNullable<ReturnType<typeof usePlatformSubscriptionsData>["data"]>[number];

export function PlatformSubscriptionsView() {
  const online = useConnectivity();
  const { data: rows, loading } = usePlatformSubscriptionsData();

  if (loading || rows === undefined) {
    return <LoadingState label="Loading subscriptions…" />;
  }
  if (!rows) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No subscription cache yet"
        description="Open this page online once so licences can be reviewed offline."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Every organization licence, renewal date, revenue, and quick management actions."
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing cached subscriptions while offline. Plan, licence, and invoice actions require a
          connection.
        </p>
      ) : null}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={CreditCard} title="No organizations yet" />
            </div>
          ) : (
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Renewal</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Devices</th>
                  <th className="px-4 py-3 font-medium">Storage</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">Last payment</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ClickableTableRow key={row.id} href={`/platform/${row.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-muted-foreground text-xs">{row.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span>{row.plan}</span>
                        {row.billingCycle ? (
                          <span className="text-muted-foreground text-xs capitalize">
                            {row.billingCycle}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={row.status === "active" ? "success" : "secondary"}>
                          {row.status}
                        </Badge>
                        {row.subscriptionStatus ? (
                          <Badge variant="outline">{row.subscriptionStatus}</Badge>
                        ) : null}
                        {row.isLifetime ? <Badge variant="outline">Lifetime</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.renewalDate ? formatDateTime(row.renewalDate) : "—"}
                    </td>
                    <td className="px-4 py-3">{row.users}</td>
                    <td className="px-4 py-3">{row.devices}</td>
                    <td className="px-4 py-3">{formatPlanBytes(row.storageBytes)}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(row.revenueAll)}</td>
                    <td className="px-4 py-3">
                      {row.lastPaymentAt ? (
                        <>
                          <p>{formatCurrency(row.lastPaymentAmount ?? 0)}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatDateTime(row.lastPaymentAt)}
                          </p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SubscriptionRowActions row={row} online={online} />
                    </td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubscriptionRowActions({ row, online }: { row: SubscriptionRow; online: boolean }) {
  const setStatus = useMutation(api.platform.setOrganizationStatus);
  const extendSubscription = useMutation(api.platform.extendSubscription);
  const recordManualInvoice = useMutation(api.billing.recordManualInvoice);

  const [pending, setPending] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState("30");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");

  async function run(label: string, work: () => Promise<unknown>) {
    setPending(true);
    try {
      await work();
      toast.success(label);
    } catch (error) {
      showError(error, "Action failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="ghost" aria-label="Subscription actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/platform/${row.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/platform/${row.id}?tab=licence`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit plan
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!online} onClick={() => setExtendOpen(true)}>
            <CreditCard className="mr-2 h-4 w-4" />
            Extend licence
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!online} onClick={() => setInvoiceOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Record invoice
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!online || pending || row.status === "suspended"}
            className="text-destructive focus:text-destructive"
            onClick={() =>
              void run("Organization suspended", () =>
                setStatus({ organizationId: row.id, status: "suspended" }),
              )
            }
          >
            <ShieldOff className="mr-2 h-4 w-4" />
            Suspend
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Extend {row.name}&rsquo;s licence</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor={`extend-${row.id}`}>Days to add</Label>
            <Input
              id={`extend-${row.id}`}
              type="number"
              min={1}
              max={3650}
              value={extendDays}
              onChange={(event) => setExtendDays(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExtendOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                const days = Number(extendDays);
                if (!Number.isInteger(days) || days <= 0) {
                  toast.error("Enter a whole number of days");
                  return;
                }
                void run(`Extended by ${days} days`, () =>
                  extendSubscription({ organizationId: row.id, days }),
                ).then(() => setExtendOpen(false));
              }}
            >
              {pending ? "Working…" : "Extend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record invoice for {row.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-muted-foreground text-xs">
              Novend has no outbound email yet — this records a pending invoice on the
              organization&rsquo;s billing history, reconciled once paid.
            </p>
            <div className="space-y-2">
              <Label htmlFor={`invoice-amount-${row.id}`}>Amount ({row.currency})</Label>
              <Input
                id={`invoice-amount-${row.id}`}
                type="number"
                min={1}
                step="0.01"
                value={invoiceAmount}
                onChange={(event) => setInvoiceAmount(event.target.value)}
                placeholder={row.amount > 0 ? String(row.amount) : "0.00"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`invoice-desc-${row.id}`}>Description</Label>
              <Input
                id={`invoice-desc-${row.id}`}
                value={invoiceDescription}
                onChange={(event) => setInvoiceDescription(event.target.value)}
                placeholder={`${row.plan} subscription`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                const amount = Number(invoiceAmount);
                if (!(amount > 0)) {
                  toast.error("Enter an amount greater than zero");
                  return;
                }
                void run("Invoice recorded", () =>
                  recordManualInvoice({
                    organizationId: row.id,
                    amount,
                    description: invoiceDescription.trim() || undefined,
                  }),
                ).then(() => {
                  setInvoiceOpen(false);
                  setInvoiceAmount("");
                  setInvoiceDescription("");
                });
              }}
            >
              {pending ? "Working…" : "Record invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
