"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatTime } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Grid, PageHeader } from "@/components/layout/primitives";
import { BranchFilter } from "@/components/filters/branch-filter";
import { usePermissions } from "@/hooks/use-permissions";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { DASHBOARD_OPS_WINDOW_DAYS } from "@/lib/dashboard/window";
import { useBranchesList } from "@/hooks/use-offline-lists";
import { useLocalStorage } from "@/hooks/use-ui";
import { useNarrowScreen } from "@/hooks/use-narrow-screen";
import {
  parseTopSellingMetric,
  sortTopSelling,
  TOP_SELLING_METRIC_KEY,
  type TopSellingMetric,
} from "@/lib/dashboard/top-selling";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  Package,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#38bdf8", "#0ea5e9", "#111827", "#16a34a"];

function RecentSalesTable({
  sales,
}: {
  sales: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    itemCount: number;
    total: number;
    completedAt: number;
  }>;
}) {
  if (sales.length === 0) {
    return <EmptyState title="No recent sales" description="New invoices will show up here." />;
  }

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-border border-b">
              <th className="pb-2 font-medium">Invoice</th>
              <th className="pb-2 font-medium">Customer</th>
              <th className="pb-2 font-medium">Items</th>
              <th className="pb-2 font-medium">Total</th>
              <th className="pb-2 font-medium">Time</th>
              <th className="pb-2 font-medium">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <ClickableTableRow
                key={sale.id}
                href={`/orders/${sale.id}`}
                className="border-border/70 border-b last:border-0"
              >
                <td className="py-2.5 font-medium">{sale.invoiceNumber}</td>
                <td className="py-2.5">{sale.customerName}</td>
                <td className="py-2.5">{sale.itemCount}</td>
                <td className="py-2.5">{formatCurrency(sale.total)}</td>
                <td className="text-muted-foreground py-2.5">{formatTime(sale.completedAt)}</td>
                <td className="py-2.5">
                  <Button asChild size="icon" variant="ghost" aria-label="View order details">
                    <Link href={`/orders/${sale.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </td>
              </ClickableTableRow>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {sales.map((sale) => (
          <Link
            key={sale.id}
            href={`/orders/${sale.id}`}
            className="border-border hover:border-primary block rounded-lg border px-3 py-2.5"
          >
            <div className="flex justify-between gap-2">
              <p className="min-w-0 truncate font-medium">{sale.invoiceNumber}</p>
              <p className="shrink-0 font-semibold whitespace-nowrap">
                {formatCurrency(sale.total)}
              </p>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {sale.customerName} · {sale.itemCount} items · {formatTime(sale.completedAt)}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

type KpiItem = {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

function KpiBentoGrid({ kpis }: { kpis: readonly KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 min-w-0">
        <KpiCard {...kpis[0]} featured />
      </div>
      {kpis.slice(1).map((kpi) => (
        <div key={kpi.title} className="min-w-0">
          <KpiCard {...kpi} />
        </div>
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  href,
  featured = false,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  featured?: boolean;
}) {
  const iconBox = (
    <div
      className={cn(
        "bg-accent text-accent-foreground flex shrink-0 items-center justify-center rounded-lg",
        featured ? "h-12 w-12" : "h-10 w-10",
      )}
    >
      <Icon className={featured ? "h-6 w-6" : "h-5 w-5"} />
    </div>
  );

  return (
    <Link href={href} className="group block h-full min-w-0">
      <Card className="h-full min-w-0 transition-shadow group-hover:shadow-md">
        <CardContent className={cn(featured ? "p-5 sm:p-6" : "p-4")}>
          {/* Mobile: value + icon on top, full title at bottom (no truncate) */}
          <div className="flex h-full flex-col gap-3 md:hidden">
            <div className="flex items-start justify-between gap-3">
              <p
                className={cn(
                  "min-w-0 truncate font-semibold tracking-tight",
                  featured ? "text-3xl" : "text-2xl",
                )}
              >
                {value}
              </p>
              {iconBox}
            </div>
            <p className="text-muted-foreground mt-auto text-sm leading-snug">{title}</p>
          </div>

          {/* Desktop: title above value, icon on the right */}
          <div className="hidden items-start justify-between gap-3 md:flex">
            <div className="min-w-0">
              <p className="text-muted-foreground truncate text-sm">{title}</p>
              <p
                className={cn(
                  "mt-2 truncate font-semibold tracking-tight",
                  featured ? "text-3xl" : "text-2xl",
                )}
              >
                {value}
              </p>
              <p className="text-primary mt-2 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                View details →
              </p>
            </div>
            <div
              className={cn(
                "bg-accent text-accent-foreground flex shrink-0 items-center justify-center rounded-lg",
                featured ? "h-12 w-12" : "h-10 w-10",
              )}
            >
              <Icon className={featured ? "h-6 w-6" : "h-5 w-5"} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TopSellingMetricToggle({
  value,
  onChange,
}: {
  value: TopSellingMetric;
  onChange: (value: TopSellingMetric) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(parseTopSellingMetric(next))}>
      <TabsList className="h-8" aria-label="Rank top selling by">
        <TabsTrigger value="quantity" className="h-6 px-2 text-xs">
          Quantity
        </TabsTrigger>
        <TabsTrigger value="amount" className="h-6 px-2 text-xs">
          Amount
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function TopSellingList({
  products,
  metric,
  bordered = false,
}: {
  products: Array<{ id: string; name: string; quantity: number; total: number }>;
  metric: TopSellingMetric;
  bordered?: boolean;
}) {
  const ranked = sortTopSelling(products, metric);
  if (ranked.length === 0) {
    return <EmptyState title={bordered ? "No product sales yet" : "No products sold yet"} />;
  }

  return (
    <ul className="space-y-3">
      {ranked.map((product) => (
        <li key={product.id}>
          <Link
            href={`/products/${product.id}`}
            className={
              bordered
                ? "border-border hover:border-primary flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                : "hover:bg-muted/50 flex min-w-0 items-center justify-between gap-3 rounded-lg px-1 py-1"
            }
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="text-muted-foreground text-xs">
                {metric === "quantity"
                  ? formatCurrency(product.total)
                  : `${formatNumber(product.quantity)} ${bordered ? "units" : "sold"}`}
              </p>
            </div>
            <p
              className={`shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums ${bordered ? "text-primary" : ""}`}
            >
              {metric === "quantity"
                ? `${formatNumber(product.quantity)} ${bordered ? "units" : "sold"}`
                : formatCurrency(product.total)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SalesOverviewChart({ data }: { data: Array<{ date: string; total: number }> }) {
  const narrow = useNarrowScreen();
  return (
    <div className="h-52 w-full min-w-0 overflow-hidden sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => String(value).slice(5)}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={narrow ? 28 : 16}
          />
          <YAxis
            hide={narrow}
            width={36}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Area type="monotone" dataKey="total" stroke="#38bdf8" fill="url(#salesFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardView() {
  const { isAdmin, isManager, branchName, branchId: myBranchId } = usePermissions();
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "all">("all");
  const [topSellingMetric, setTopSellingMetric] = useLocalStorage<TopSellingMetric>(
    TOP_SELLING_METRIC_KEY,
    "quantity",
  );
  const metric = parseTopSellingMetric(topSellingMetric);
  const mirroredBranches = useBranchesList(false, Boolean(isAdmin || isManager));
  const branches = isAdmin || isManager ? mirroredBranches : undefined;
  const { data, loading } = useDashboardData(branchFilter);

  if (loading || !data) {
    return <LoadingState label="Loading dashboard…" />;
  }

  const showOps = data.role === "administrator" || data.role === "manager";
  const inventoryAlertHref = (kind: "low" | "expiry") => {
    const params = new URLSearchParams({ filter: kind });
    const branch = branchFilter !== "all" ? branchFilter : myBranchId;
    if (branch) params.set("branch", String(branch));
    return `/inventory?${params.toString()}`;
  };

  const kpis = [
    {
      title: showOps ? `Sales (${DASHBOARD_OPS_WINDOW_DAYS} days)` : "Today's Sales",
      value: formatCurrency(data.kpis.revenue),
      icon: Wallet,
      href: "/orders",
    },
    {
      title: showOps ? `Orders (${DASHBOARD_OPS_WINDOW_DAYS} days)` : "Today's Orders",
      value: formatNumber(data.kpis.orders),
      icon: ShoppingBag,
      href: "/orders",
    },
    {
      title: showOps ? "Total Customers" : "Items Sold",
      value: formatNumber(showOps ? (data.kpis.customersEstimate ?? 0) : data.kpis.itemsSold),
      icon: showOps ? Users : Package,
      href: showOps ? "/customers" : "/orders",
    },
    {
      title: "Low Stock Items",
      value: formatNumber(data.kpis.lowStockCount),
      icon: AlertTriangle,
      href: inventoryAlertHref("low"),
    },
    {
      title: "Expiring / Expired",
      value: formatNumber(data.kpis.expiringCount ?? 0),
      icon: CalendarClock,
      href: inventoryAlertHref("expiry"),
    },
  ] as const;

  return (
    <div className="min-w-0 space-y-6" data-tour="page-content">
      <PageHeader
        title="Dashboard"
        description={
          showOps
            ? `Last ${DASHBOARD_OPS_WINDOW_DAYS} days of sales, plus stock alerts`
            : "Your sales activity today"
        }
        compactActions={[
          { key: "inventory", label: "Inventory", icon: Package, href: "/inventory" },
          { key: "sale", label: "New Sale", icon: ShoppingBag, href: "/sales" },
        ]}
        actions={
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto">
            {isAdmin ? (
              <BranchFilter
                inline
                branches={branches}
                value={branchFilter}
                onChange={setBranchFilter}
                allowAll
                className="min-w-0 flex-1 sm:flex-none"
              />
            ) : isManager && branchName ? (
              <BranchFilter
                inline
                branches={branches}
                value={myBranchId}
                onChange={() => undefined}
                lockedLabel={branchName}
                className="min-w-0 flex-1 sm:flex-none"
              />
            ) : null}
            <Button asChild variant="outline" className="hidden h-9 shrink-0 sm:inline-flex">
              <Link href="/inventory">Inventory</Link>
            </Button>
            <Button asChild className="h-9 min-h-9 flex-1 shrink-0 sm:flex-none">
              <Link href="/sales">New Sale</Link>
            </Button>
          </div>
        }
      />

      {/* Mobile: 2×3 bento grid (hero KPI spans 2 cols) · Desktop: row */}
      <div className="md:hidden">
        <KpiBentoGrid kpis={kpis} />
      </div>
      <div className="hidden md:block">
        <Grid cols={5}>
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </Grid>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Card className="min-w-0 overflow-hidden xl:col-span-2">
          <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <CardTitle>
              {showOps ? `Sales Overview (${DASHBOARD_OPS_WINDOW_DAYS} days)` : "Sales Overview"}
            </CardTitle>
            <Button asChild size="sm" variant="ghost" className="self-start sm:self-auto">
              <Link href="/reports">Reports</Link>
            </Button>
          </CardHeader>
          <CardContent className="min-w-0 p-3 pt-0 sm:p-6 sm:pt-0">
            {data.salesTrend.length === 0 ? (
              <EmptyState title="No sales yet" description="Completed sales will appear here." />
            ) : (
              <SalesOverviewChart data={data.salesTrend} />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <CardTitle className="text-base sm:text-lg">
              {showOps ? "Sales by Category" : "Top Selling Products"}
            </CardTitle>
            {showOps ? null : (
              <TopSellingMetricToggle value={metric} onChange={setTopSellingMetric} />
            )}
          </CardHeader>
          <CardContent className="min-w-0 overflow-y-auto p-3 pt-0 sm:p-6 sm:pt-0">
            {showOps ? (
              data.salesByCategory.length === 0 ? (
                <EmptyState title="No category data" />
              ) : (
                <div className="h-52 w-full min-w-0 overflow-hidden sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.salesByCategory}
                        dataKey="total"
                        nameKey="name"
                        innerRadius="38%"
                        outerRadius="70%"
                        paddingAngle={3}
                      >
                        {data.salesByCategory.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )
            ) : (
              <div className="max-h-52 min-w-0 overflow-y-auto sm:max-h-72">
                <TopSellingList products={data.topProducts} metric={metric} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showOps ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <CardTitle>Top Selling Products</CardTitle>
              <TopSellingMetricToggle value={metric} onChange={setTopSellingMetric} />
            </CardHeader>
            <CardContent>
              <TopSellingList products={data.topProducts} metric={metric} bordered />
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Recent Sales</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {data.lowStock.length > 0 ? (
                  <Badge variant="warning">{data.lowStock.length} low stock</Badge>
                ) : null}
                {(data.kpis.expiringCount ?? 0) > 0 ? (
                  <Badge variant="destructive">{data.kpis.expiringCount} expiring</Badge>
                ) : null}
                <Button asChild size="sm" variant="ghost">
                  <Link href="/orders">All orders</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <RecentSalesTable sales={data.recentSales} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Recent Sales</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {data.lowStock.length > 0 ? (
                <Badge variant="warning">{data.lowStock.length} low stock</Badge>
              ) : null}
              {(data.kpis.expiringCount ?? 0) > 0 ? (
                <Badge variant="destructive">{data.kpis.expiringCount} expiring</Badge>
              ) : null}
              <Button asChild size="sm" variant="ghost">
                <Link href="/orders">All orders</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <RecentSalesTable sales={data.recentSales} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
