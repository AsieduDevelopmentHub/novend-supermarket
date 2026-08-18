"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatTime } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Grid } from "@/components/layout/primitives";
import { BranchFilter } from "@/components/filters/branch-filter";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { formatDateTime } from "@/lib/date";
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

const PIE_COLORS = ["#38bdf8", "#0ea5e9", "#111827", "#16a34a"];

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

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
              <p className="shrink-0 whitespace-nowrap font-semibold">
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

function KpiCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link href={href} className="group block min-w-0">
      <Card className="min-w-0 transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="text-muted-foreground truncate text-sm">{title}</p>
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
            <p className="text-primary mt-2 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
              View details →
            </p>
          </div>
          <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TopSellingList({
  products,
  bordered = false,
}: {
  products: Array<{ id: string; name: string; quantity: number; total: number }>;
  bordered?: boolean;
}) {
  if (products.length === 0) {
    return <EmptyState title={bordered ? "No product sales yet" : "No products sold yet"} />;
  }

  return (
    <ul className="space-y-3">
      {products.map((product) => (
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
                {product.quantity} {bordered ? "units" : "sold"}
              </p>
            </div>
            <p
              className={`shrink-0 whitespace-nowrap text-sm font-semibold ${bordered ? "text-primary" : ""}`}
            >
              {formatCurrency(product.total)}
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
  const online = useConnectivity();
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "all">("all");
  const branches = useQuery(api.branches.list, online && (isAdmin || isManager) ? {} : "skip");
  const { data, loading } = useDashboardData(branchFilter);

  if (loading || !data) {
    return <LoadingState label="Loading dashboard…" />;
  }

  const showOps = data.role === "administrator" || data.role === "manager";
  const offlineNote =
    data.source === "cache"
      ? `Showing last synced dashboard${data.cachedAt ? ` · ${formatDateTime(data.cachedAt)}` : ""}`
      : data.source === "local"
        ? "Showing offline activity from this device"
        : null;

  return (
    <div className="min-w-0 space-y-6">
      {offlineNote ? (
        <p className="text-muted-foreground border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {offlineNote}. Figures refresh when you reconnect.
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {showOps ? "Business performance overview" : "Your sales activity today"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {isAdmin && online ? (
            <BranchFilter
              branches={branches}
              value={branchFilter}
              onChange={setBranchFilter}
              allowAll
            />
          ) : isManager && branchName ? (
            <BranchFilter
              branches={branches}
              value={myBranchId}
              onChange={() => undefined}
              lockedLabel={branchName}
            />
          ) : null}
          <Button asChild variant="outline">
            <Link href="/inventory">Inventory</Link>
          </Button>
          <Button asChild>
            <Link href="/sales">New Sale</Link>
          </Button>
        </div>
      </div>

      <Grid cols={5}>
        <KpiCard
          title={showOps ? "Total Sales" : "Today's Sales"}
          value={formatCurrency(data.kpis.revenue)}
          icon={Wallet}
          href="/orders"
        />
        <KpiCard
          title={showOps ? "Total Orders" : "Today's Orders"}
          value={formatNumber(data.kpis.orders)}
          icon={ShoppingBag}
          href="/orders"
        />
        <KpiCard
          title={showOps ? "Total Customers" : "Items Sold"}
          value={formatNumber(showOps ? (data.kpis.customersEstimate ?? 0) : data.kpis.itemsSold)}
          icon={showOps ? Users : Package}
          href={showOps ? "/customers" : "/orders"}
        />
        <KpiCard
          title="Low Stock Items"
          value={formatNumber(data.kpis.lowStockCount)}
          icon={AlertTriangle}
          href="/inventory?filter=low"
        />
        <KpiCard
          title="Expiring / Expired"
          value={formatNumber(data.kpis.expiringCount ?? 0)}
          icon={CalendarClock}
          href="/inventory?filter=expiry"
        />
      </Grid>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Card className="min-w-0 overflow-hidden xl:col-span-2">
          <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <CardTitle>Sales Overview</CardTitle>
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
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">
              {showOps ? "Sales by Category" : "Top Selling Products"}
            </CardTitle>
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
                <TopSellingList products={data.topProducts} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showOps ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              <TopSellingList products={data.topProducts} bordered />
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
