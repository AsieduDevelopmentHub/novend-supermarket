"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ListPagination } from "@/components/ui/list-pagination";
import { usePermissions } from "@/hooks/use-permissions";
import { useLicense } from "@/hooks/use-license";
import { useConnectivity } from "@/hooks/use-connectivity";
import { formatCurrency } from "@/lib/currency";
import {
  formatDateTime,
  rangeForDatePreset,
  toLocalDateInput,
  type DateRangePreset,
} from "@/lib/date";
import { currentPayPeriodKey, isPayPeriodKey } from "@/convex/shared/payroll";
import { newClientId } from "@/lib/offline/db";
import {
  persistBusinessWrite,
  queuePayCommission,
  queuePaySalary,
  queueUpsertStaffCompensation,
  queuedSaveMessage,
} from "@/lib/offline/replica-writes";
import {
  useStaffCompensation,
  useStaffMonthRecord,
  useStaffPerformance,
} from "@/features/users/hooks/use-staff-payroll";
import { useConvexPagedList } from "@/hooks/use-convex-paged-list";
import { showError } from "@/lib/errors";
import { Banknote, Receipt, RotateCcw, ShoppingBag, Wallet, Percent } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
];

type Props = {
  profileId: Id<"profiles">;
  userId: string;
  userName: string;
};

export function UserCommandCenter({ profileId, userId, userName }: Props) {
  const { canManagePayroll, canViewStaffPerformance } = usePermissions();
  const { capabilities, planName } = useLicense();
  const online = useConnectivity();
  const [preset, setPreset] = useState<DateRangePreset>("month");
  const [tab, setTab] = useState("performance");
  const range = rangeForDatePreset(preset);
  const performance = useStaffPerformance({
    profileId,
    userId,
    startDate: range.startDate,
    endDate: range.endDate,
    enabled: canViewStaffPerformance,
  });
  const showPayroll = canManagePayroll && capabilities.canManageStaffCompensation;

  if (!canViewStaffPerformance) return null;

  const offlineNote = !online ? (
    <p className="text-muted-foreground text-xs">
      Offline — showing data from this device. Payroll changes sync when you reconnect.
    </p>
  ) : null;

  const kpis = performance
    ? [
        {
          title: "Net sales",
          value: formatCurrency(performance.netSales),
          icon: Banknote,
          href: `/orders?cashierId=${userId}`,
          tab: "sales",
        },
        {
          title: "Orders",
          value: String(performance.orderCount),
          icon: ShoppingBag,
          href: `/orders?cashierId=${userId}`,
          tab: "sales",
        },
        {
          title: "Returns",
          value: `${performance.returnCount} · ${formatCurrency(performance.refundTotal)}`,
          icon: RotateCcw,
          href: "/returns",
          tab: "returns",
        },
        {
          title: "Staff expenses",
          value: formatCurrency(performance.staffExpenseTotal),
          icon: Receipt,
          href: "/analytics",
          tab: "expenses",
        },
        ...(showPayroll
          ? [
              {
                title: "Commission earned",
                value: formatCurrency(performance.commissionEarned),
                icon: Percent,
                href: "#commission",
                tab: "commission",
              },
              {
                title: "Salary paid",
                value: formatCurrency(performance.salaryPaid),
                icon: Wallet,
                href: "#salary",
                tab: "salary",
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Staff command center</h2>
          <p className="text-muted-foreground text-sm">
            Performance, payroll, and activity for this account.
          </p>
          {offlineNote}
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="user-range" className="sr-only">
            Date range
          </Label>
          <Select value={preset} onValueChange={(value) => setPreset(value as DateRangePreset)}>
            <SelectTrigger id="user-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {performance === undefined ? (
        <LoadingState label="Loading performance…" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <button
              key={kpi.title}
              type="button"
              className="group text-left"
              onClick={() => setTab(kpi.tab)}
            >
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">{kpi.title}</p>
                    <p className="mt-1 truncate text-xl font-semibold tracking-tight">
                      {kpi.value}
                    </p>
                    <p className="text-primary mt-2 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                      View details →
                    </p>
                  </div>
                  <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <kpi.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={cn("h-auto w-full flex-wrap justify-start")}>
          <TabsTrigger value="performance">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          {showPayroll ? <TabsTrigger value="salary">Salary</TabsTrigger> : null}
          {showPayroll ? <TabsTrigger value="commission">Commission</TabsTrigger> : null}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Period snapshot</CardTitle>
              <CardDescription>
                Gross {performance ? formatCurrency(performance.grossSales) : "—"} minus returns{" "}
                {performance ? formatCurrency(performance.refundTotal) : "—"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
              <p>Expenses they recorded: {performance?.expensesRecordedCount ?? 0}</p>
              <p>
                Recorded amount:{" "}
                {performance ? formatCurrency(performance.expensesRecordedTotal) : "—"}
              </p>
              {showPayroll ? (
                <p>
                  Commission outstanding:{" "}
                  {performance ? formatCurrency(performance.commissionOutstanding) : "—"}
                </p>
              ) : (
                <p className="sm:col-span-2">
                  Salary and commission are available on Pro and above (current plan: {planName}).
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <RecordTable
            empty="No orders in this range."
            hrefLabel="Open orders"
            href={`/orders?cashierId=${userId}`}
            rows={(performance?.orders ?? []).map((row) => ({
              id: row.id,
              href: `/orders/${row.id}`,
              cells: [
                row.invoiceNumber,
                row.customerName,
                formatDateTime(row.completedAt),
                formatCurrency(row.total),
              ],
            }))}
            headers={["Invoice", "Customer", "Date", "Total"]}
          />
        </TabsContent>

        <TabsContent value="returns">
          <RecordTable
            empty="No returns against this cashier's orders."
            hrefLabel="Open returns"
            href="/returns"
            rows={(performance?.returns ?? []).map((row) => ({
              id: row.id,
              href: `/returns/${row.id}`,
              cells: [
                row.returnNumber,
                formatDateTime(row.completedAt),
                formatCurrency(row.refundAmount),
              ],
            }))}
            headers={["Return", "Date", "Refund"]}
          />
        </TabsContent>

        <TabsContent value="expenses">
          <RecordTable
            empty="No staff expenses linked to this user."
            hrefLabel="Open analytics"
            href="/analytics"
            rows={(performance?.expenses ?? []).map((row) => ({
              id: row.id,
              href: "/analytics",
              cells: [
                row.category,
                row.payPeriodKey ?? "—",
                formatDateTime(row.occurredAt),
                formatCurrency(row.amount),
              ],
            }))}
            headers={["Category", "Period", "Date", "Amount"]}
          />
        </TabsContent>

        {showPayroll ? (
          <TabsContent value="salary">
            <PayrollPanel profileId={profileId} userId={userId} userName={userName} kind="salary" />
          </TabsContent>
        ) : null}
        {showPayroll ? (
          <TabsContent value="commission">
            <PayrollPanel
              profileId={profileId}
              userId={userId}
              userName={userName}
              kind="commission"
            />
          </TabsContent>
        ) : null}

        <TabsContent value="activity">
          <UserActivityTab profileId={profileId} online={online} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserActivityTab({ profileId, online }: { profileId: Id<"profiles">; online: boolean }) {
  const activity = useConvexPagedList(api.payroll.activity, online ? { profileId } : "skip", {
    enabled: online,
    resetKey: profileId,
  });

  if (!online) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-5 text-sm">
          Activity history needs a connection. Performance and payroll stay available offline.
        </CardContent>
      </Card>
    );
  }

  if (activity.isLoading) {
    return <LoadingState label="Loading activity…" />;
  }

  if (activity.items.length === 0) {
    return (
      <EmptyState title="No activity yet" description="Audit events for this user appear here." />
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="divide-y p-0">
        {activity.items.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{row.actionLabel}</p>
              <p className="text-muted-foreground text-xs">
                {row.areaLabel}
                {row.detail && row.detail !== "—" ? ` · ${row.detail}` : ""}
              </p>
            </div>
            <p className="text-muted-foreground shrink-0 text-xs">
              {formatDateTime(row.createdAt)}
            </p>
          </div>
        ))}
      </CardContent>
      <ListPagination
        page={activity.page}
        pageSize={activity.pageSize}
        total={activity.total}
        hasNextPage={activity.hasNextPage}
        onPageChange={activity.setPage}
        onPageSizeChange={activity.setPageSize}
      />
    </Card>
  );
}

function RecordTable({
  headers,
  rows,
  empty,
  href,
  hrefLabel,
}: {
  headers: string[];
  rows: Array<{ id: string; href: string; cells: string[] }>;
  empty: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href={href}>{hrefLabel}</Link>
          </Button>
        </div>
        {rows.length === 0 ? (
          <EmptyState title={empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left">
                  {headers.map((header) => (
                    <th key={header} className="px-2 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ClickableTableRow key={row.id} href={row.href}>
                    {row.cells.map((cell, index) => (
                      <td key={`${row.id}-${index}`} className="px-2 py-2">
                        {cell}
                      </td>
                    ))}
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PayrollPanel({
  profileId,
  userId,
  userName,
  kind,
}: {
  profileId: Id<"profiles">;
  userId: string;
  userName: string;
  kind: "salary" | "commission";
}) {
  const compensation = useStaffCompensation(profileId, true);
  if (compensation === undefined) {
    return <LoadingState label="Loading payroll…" />;
  }
  if (!compensation) {
    return (
      <EmptyState
        title="Payroll unavailable offline"
        description="Sync once while online to mirror staff compensation on this device."
      />
    );
  }
  return (
    <PayrollForm
      key={profileId}
      profileId={profileId}
      userId={userId}
      userName={userName}
      kind={kind}
      initial={compensation}
    />
  );
}

function PayrollForm({
  profileId,
  userId,
  userName,
  kind,
  initial,
}: {
  profileId: Id<"profiles">;
  userId: string;
  userName: string;
  kind: "salary" | "commission";
  initial: {
    salaryAmount: number | null;
    salaryFrequency: "monthly" | "weekly";
    commissionRate: number | null;
    commissionBasis: "net" | "gross";
    currentPeriodKey: string;
  };
}) {
  const online = useConnectivity();
  const upsertCompensation = useMutation(api.payroll.upsertCompensation);
  const paySalary = useMutation(api.payroll.paySalary);
  const payCommission = useMutation(api.payroll.payCommission);
  const [salaryAmount, setSalaryAmount] = useState(
    initial.salaryAmount != null ? String(initial.salaryAmount) : "",
  );
  const [salaryFrequency, setSalaryFrequency] = useState(initial.salaryFrequency);
  const [commissionRate, setCommissionRate] = useState(
    initial.commissionRate != null ? String(initial.commissionRate) : "",
  );
  const [commissionBasis, setCommissionBasis] = useState(initial.commissionBasis);
  const [payPeriodKey, setPayPeriodKey] = useState(initial.currentPeriodKey);
  const [pending, setPending] = useState(false);
  const monthRecord = useStaffMonthRecord({
    profileId,
    userId,
    userName,
    payPeriodKey,
    enabled: isPayPeriodKey(payPeriodKey, salaryFrequency),
  });

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const payload = {
        profileId,
        salaryAmount: salaryAmount === "" ? undefined : Number(salaryAmount),
        salaryFrequency,
        commissionRate: commissionRate === "" ? undefined : Number(commissionRate),
        commissionBasis,
      };
      const kind = await persistBusinessWrite({
        online,
        remote: () => upsertCompensation(payload),
        local: () => queueUpsertStaffCompensation(payload),
      });
      toast.success(queuedSaveMessage(kind, "Compensation saved"));
    } catch (error) {
      showError(error, "Could not save compensation");
    } finally {
      setPending(false);
    }
  }

  async function onPay() {
    const period = payPeriodKey || currentPayPeriodKey(salaryFrequency);
    setPending(true);
    try {
      if (kind === "salary") {
        const clientOperationId = newClientId("pay_salary");
        const kindResult = await persistBusinessWrite({
          online,
          remote: () => paySalary({ profileId, payPeriodKey: period, clientOperationId }),
          local: () => queuePaySalary({ profileId, payPeriodKey: period, clientOperationId }),
        });
        toast.success(queuedSaveMessage(kindResult, `Salary recorded for ${period}`));
      } else {
        const clientOperationId = newClientId("pay_commission");
        const kindResult = await persistBusinessWrite({
          online,
          remote: () => payCommission({ profileId, payPeriodKey: period, clientOperationId }),
          local: () => queuePayCommission({ profileId, payPeriodKey: period, clientOperationId }),
        });
        toast.success(queuedSaveMessage(kindResult, `Commission recorded for ${period}`));
      }
    } catch (error) {
      showError(
        error,
        kind === "salary" ? "Could not record salary" : "Could not record commission",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compensation</CardTitle>
          <CardDescription>
            Payments post as organization expenses and reduce net profit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSave}>
            <div className="space-y-2">
              <Label htmlFor="salary-amount">Salary amount</Label>
              <Input
                id="salary-amount"
                inputMode="decimal"
                value={salaryAmount}
                onChange={(event) => setSalaryAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={salaryFrequency}
                onValueChange={(value) => setSalaryFrequency(value as "monthly" | "weekly")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commission-rate">Commission %</Label>
              <Input
                id="commission-rate"
                inputMode="decimal"
                value={commissionRate}
                onChange={(event) => setCommissionRate(event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Commission basis</Label>
              <Select
                value={commissionBasis}
                onValueChange={(value) => setCommissionBasis(value as "net" | "gross")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="net">Net sales (after returns)</SelectItem>
                  <SelectItem value="gross">Gross sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                Save compensation
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {kind === "salary" ? "Record salary" : "Record commission"}
          </CardTitle>
          <CardDescription>
            {kind === "salary"
              ? "One salary expense per pay period. Recording twice is rejected."
              : "Pays outstanding commission for the period from completed sales minus returns."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-period">Pay period</Label>
              <Input
                id="pay-period"
                value={payPeriodKey}
                onChange={(event) => setPayPeriodKey(event.target.value)}
                placeholder={
                  salaryFrequency === "weekly" ? "2026-W12" : toLocalDateInput().slice(0, 7)
                }
              />
            </div>
            <div className="flex items-end">
              <Button type="button" disabled={pending} onClick={() => void onPay()}>
                {kind === "salary" ? "Record salary payment" : "Record commission payment"}
              </Button>
            </div>
          </div>
          {monthRecord ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Salary</dt>
                <dd className="font-medium">
                  {formatCurrency(monthRecord.salaryPaid)} / {formatCurrency(monthRecord.salaryDue)}{" "}
                  <Badge variant={monthRecord.salaryStatus === "paid" ? "success" : "secondary"}>
                    {monthRecord.salaryStatus}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Commission</dt>
                <dd className="font-medium">
                  {formatCurrency(monthRecord.commissionPaid)} earned{" "}
                  {formatCurrency(monthRecord.commissionEarned)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Other expenses</dt>
                <dd className="font-medium">{formatCurrency(monthRecord.otherExpenses)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total staff cost</dt>
                <dd className="font-medium">{formatCurrency(monthRecord.totalStaffCost)}</dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
