"use client";

import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, CreditCard, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatPlanBytes } from "@/convex/shared/plans";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformRevenueData } from "@/hooks/use-platform-offline-data";

const RANGES = [
  { id: "today" as const, label: "Today" },
  { id: "7d" as const, label: "7 days" },
  { id: "30d" as const, label: "30 days" },
  { id: "12m" as const, label: "12 months" },
];

const PLAN_COLORS = ["#38bdf8", "#0ea5e9", "#111827", "#16a34a"];

export function PlatformRevenueView() {
  const online = useConnectivity();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("30d");
  const { data, loading } = usePlatformRevenueData(range);

  if (loading || data === undefined) {
    return <LoadingState label="Loading revenue analytics…" />;
  }
  if (!data) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No revenue cache yet"
        description="Open this page online once so analytics can be stored for offline review."
      />
    );
  }

  const planTotal = data.planDistribution.reduce((sum, row) => sum + row.count, 0) || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        description="Recognized subscription MRR (active and past-due only; custom offers when set), collected payments, and profit after platform operating costs."
        actions={
          <div className="flex flex-wrap gap-1">
            {RANGES.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={range === item.id ? "default" : "outline"}
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        }
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing cached revenue for this range while offline.
        </p>
      ) : null}

      <Grid cols={4}>
        <Kpi
          title="MRR"
          value={formatCurrency(data.mrr)}
          hint="Monthly recurring"
          icon={TrendingUp}
        />
        <Kpi title="ARR" value={formatCurrency(data.arr)} hint="MRR × 12" icon={Wallet} />
        <Kpi
          title="Gross revenue"
          value={formatCurrency(data.grossRevenue)}
          hint={`Successful payments · ${RANGES.find((r) => r.id === range)?.label}`}
          icon={CreditCard}
        />
        <Kpi
          title="Net profit"
          value={formatCurrency(data.netProfit)}
          hint={`Costs ${formatCurrency(data.operatingCosts)}`}
          icon={data.netProfit >= 0 ? TrendingUp : TrendingDown}
        />
      </Grid>

      <Grid cols={4}>
        <Stat label="Active orgs" value={String(data.activeOrganizations)} />
        <Stat label="Trials" value={String(data.trialOrganizations)} />
        <Stat label="Lifetime licences" value={String(data.lifetimeLicenses)} />
        <Stat
          label="Renewal / churn"
          value={`${Math.round(data.renewalRate * 100)}% / ${Math.round(data.churnRate * 100)}%`}
        />
      </Grid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Plan distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[minmax(0,140px)_1fr] items-center gap-4">
              <div className="h-36 w-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.planDistribution}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={64}
                      paddingAngle={2}
                    >
                      {data.planDistribution.map((entry, index) => (
                        <Cell key={entry.key} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5">
                {data.planDistribution.map((plan, index) => {
                  const pct = Math.round((plan.count / planTotal) * 100);
                  return (
                    <div key={plan.key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: PLAN_COLORS[index % PLAN_COLORS.length] }}
                        />
                        {plan.name}
                      </span>
                      <span className="text-muted-foreground">
                        {plan.count} · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue, costs &amp; profit</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByMonth.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No billed months in this range"
                description="Successful Paystack / manual payments will appear here."
              />
            ) : (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.revenueByMonth}
                    margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis width={48} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="costs" name="Costs" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Profit"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New organizations per month</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByMonth.length === 0 ? (
              <EmptyState title="No new organizations in this range" />
            ) : (
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.revenueByMonth}
                    margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis width={32} tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Bar
                      dataKey="newOrganizations"
                      name="New orgs"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cloud storage usage trend</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByMonth.length === 0 ? (
              <EmptyState title="No storage activity in this range" />
            ) : (
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.revenueByMonth}
                    margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="storageFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis
                      width={56}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => formatPlanBytes(Number(value))}
                    />
                    <Tooltip formatter={(value) => formatPlanBytes(Number(value))} />
                    <Area
                      type="monotone"
                      dataKey="storageBytes"
                      name="Cloud storage"
                      stroke="#38bdf8"
                      fill="url(#storageFill)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent successful payments</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {data.recentPayments.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No successful payments in this range.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Gateway</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((payment) => (
                  <ClickableTableRow key={payment.id} href={`/platform/payments/${payment.id}`}>
                    <td className="px-4 py-3">{formatDateTime(payment.paidAt)}</td>
                    <td className="px-4 py-3">{payment.description}</td>
                    <td className="px-4 py-3 capitalize">{payment.planKey ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{payment.gateway}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(payment.amount)}</td>
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

function Kpi({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: typeof TrendingUp;
}) {
  return (
    <Card className="border-l-primary min-w-0 border-l-[3px]">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-sm">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
        </div>
        <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
