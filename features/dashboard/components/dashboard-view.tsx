"use client";

import { useEffect, useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { CURRENCY_SYMBOL, formatCurrency, formatMoneyAmount, formatNumber } from "@/lib/currency";
import { formatTime } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Grid, PageHeader } from "@/components/layout/primitives";
import { BranchFilter } from "@/components/filters/branch-filter";
import { PeriodFilter } from "@/components/filters/period-filter";
import { usePermissions } from "@/hooks/use-permissions";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useBranchesList } from "@/hooks/use-offline-lists";
import { useNarrowScreen } from "@/hooks/use-narrow-screen";
import { useUserFilterPreferences } from "@/hooks/use-user-filter-preferences";
import {
  isPeriodPreset,
  periodPresetLabel,
  resolvePeriodPreset,
  clampPeriodRangeMs,
  localIsoDate,
  type PeriodPreset,
} from "@/lib/period-filter";
import {
  parseTopSellingMetric,
  sortTopSelling,
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
  BedDouble,
  CalendarClock,
  ChefHat,
  Eye,
  Package,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useBusinessTerms } from "@/hooks/use-business-terms";
import { stockOpsVisibleForIndustry } from "@/convex/shared/businessCapabilities";
import { dashboardViewDescription } from "@/convex/shared/businessTerms";
import type { HospitalityOpsSnapshot } from "@/hooks/use-dashboard-data";

type DashboardFilterPreferences = {
  preset: PeriodPreset;
  customStart: string;
  customEnd: string;
  branchFilter: string;
  topSellingMetric: TopSellingMetric;
};

function createDashboardFilterPreferences(): DashboardFilterPreferences {
  const range = resolvePeriodPreset("last_7_days");
  return {
    preset: "last_7_days",
    customStart: range.start,
    customEnd: range.end,
    branchFilter: "all",
    topSellingMetric: "quantity",
  };
}

function isDashboardFilterPreferences(value: unknown): value is DashboardFilterPreferences {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    isPeriodPreset(row.preset) &&
    typeof row.customStart === "string" &&
    typeof row.customEnd === "string" &&
    typeof row.branchFilter === "string" &&
    (row.topSellingMetric === "quantity" || row.topSellingMetric === "amount")
  );
}

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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
  /** Unit shown beside the title (e.g. `GH₵`) so the value keeps the space. */
  unit?: string;
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

/**
 * Never truncated: the value is the reason the card exists. Sized from the
 * width its own column leaves (container query), so long totals step down a
 * font size instead of turning into "GH₵0....".
 */
function KpiValue({
  value,
  featured,
  className,
}: {
  value: string;
  featured: boolean;
  className?: string;
}) {
  return (
    <div className={cn("@container min-w-0 flex-1", className)}>
      <p
        className={cn(
          "font-semibold tracking-tight whitespace-nowrap tabular-nums",
          featured ? "text-2xl @[14rem]:text-3xl" : "text-lg @[8rem]:text-xl @[10rem]:text-2xl",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function KpiTitle({
  title,
  unit,
  className,
}: {
  title: string;
  unit?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)}>
      {title}
      {unit ? <span className="text-muted-foreground/80 font-medium"> · {unit}</span> : null}
    </p>
  );
}

function KpiCard({
  title,
  value,
  unit,
  icon: Icon,
  href,
  featured = false,
}: {
  title: string;
  value: string;
  unit?: string;
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
              <KpiValue value={value} featured={featured} />
              {iconBox}
            </div>
            <KpiTitle title={title} unit={unit} className="mt-auto leading-snug" />
          </div>

          {/* Desktop: title above value, icon on the right */}
          <div className="hidden items-start justify-between gap-3 md:flex">
            <div className="min-w-0 flex-1">
              <KpiTitle title={title} unit={unit} className="leading-snug" />
              <KpiValue value={value} featured={featured} className="mt-2" />
              <p className="text-primary mt-2 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                View details →
              </p>
            </div>
            {iconBox}
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

function StockAlertList({
  rows,
  emptyTitle,
  emptyDescription,
  kind,
}: {
  rows: Array<{
    id: string;
    productId: string;
    name: string;
    stockQuantity: number;
    unit: string;
    branchId: string | null;
    branchName: string | null;
    badge?: string;
    detail?: string;
  }>;
  emptyTitle: string;
  emptyDescription: string;
  kind: "low" | "expiry";
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/products/${row.productId}`}
            className="border-border hover:border-primary flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {row.branchName ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {row.branchName}
                  </Badge>
                ) : null}
                {row.badge ? (
                  <Badge
                    variant={kind === "expiry" ? "destructive" : "warning"}
                    className="text-[10px]"
                  >
                    {row.badge}
                  </Badge>
                ) : null}
                {row.detail ? (
                  <span className="text-muted-foreground text-xs">{row.detail}</span>
                ) : null}
              </div>
            </div>
            <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
              {formatNumber(row.stockQuantity)} {row.unit}
            </p>
          </Link>
        </li>
      ))}
    </ul>
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
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
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
          <Area type="monotone" dataKey="total" stroke="var(--chart-1)" fill="url(#salesFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HospitalityOpsCards({
  hospitality,
  terms,
}: {
  hospitality: HospitalityOpsSnapshot;
  terms: ReturnType<typeof useBusinessTerms>["terms"];
}) {
  const { hotel, dining } = hospitality;
  if (!hotel && !dining) return null;

  return (
    <div className="space-y-3">
      {hotel ? (
        <div className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            {terms.room_plural} operations
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
            <KpiCard
              title="Available"
              value={formatNumber(hotel.roomsAvailable)}
              icon={BedDouble}
              href="/rooms"
            />
            <KpiCard
              title="Occupied"
              value={formatNumber(hotel.roomsOccupied)}
              icon={BedDouble}
              href="/rooms"
            />
            <KpiCard
              title="Dirty"
              value={formatNumber(hotel.roomsDirty)}
              icon={BedDouble}
              href="/rooms"
            />
            <KpiCard
              title="Maintenance"
              value={formatNumber(hotel.roomsMaintenance)}
              icon={BedDouble}
              href="/rooms"
            />
            <KpiCard
              title="Arrivals today"
              value={formatNumber(hotel.arrivalsToday)}
              icon={CalendarClock}
              href="/reservations"
            />
            <KpiCard
              title="Departures today"
              value={formatNumber(hotel.departuresToday)}
              icon={CalendarClock}
              href="/reservations"
            />
            <KpiCard
              title={`Open ${terms.folio_plural.toLowerCase()}`}
              value={formatNumber(hotel.openFolios)}
              icon={Wallet}
              href="/rooms"
            />
            {hotel.outstandingFolioBalance !== null ? (
              <KpiCard
                title="Outstanding folios"
                value={formatMoneyAmount(hotel.outstandingFolioBalance)}
                unit={CURRENCY_SYMBOL}
                icon={Wallet}
                href="/rooms"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {dining ? (
        <div className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            {terms.floor} operations
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              title={`Occupied ${terms.table_plural.toLowerCase()}`}
              value={formatNumber(dining.occupiedTables)}
              icon={UtensilsCrossed}
              href="/floor"
            />
            <KpiCard
              title={`Open ${terms.check_plural.toLowerCase()}`}
              value={formatNumber(dining.openChecks)}
              icon={UtensilsCrossed}
              href="/floor"
            />
            <KpiCard
              title={`Pending ${terms.ticket_plural.toLowerCase()}`}
              value={formatNumber(dining.pendingKitchenTickets)}
              icon={ChefHat}
              href="/kitchen"
            />
            <KpiCard
              title="Ready tickets"
              value={formatNumber(dining.readyTickets)}
              icon={ChefHat}
              href="/kitchen"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardView() {
  const {
    isAdmin,
    isManager,
    branchName,
    branchId: myBranchId,
    role,
    userId,
  } = usePermissions();
  const { industryProfile } = useBusinessCapabilities();
  const { terms } = useBusinessTerms();
  const showStockOps = stockOpsVisibleForIndustry(industryProfile);
  const initialFilters = useMemo(createDashboardFilterPreferences, []);
  const [filters, setFilters] = useUserFilterPreferences(
    "dashboard",
    userId,
    initialFilters,
    isDashboardFilterPreferences,
  );
  const selectedDates = useMemo(
    () =>
      filters.preset === "custom"
        ? { start: filters.customStart, end: filters.customEnd }
        : resolvePeriodPreset(filters.preset),
    [filters.preset, filters.customStart, filters.customEnd],
  );
  const periodRange = useMemo(() => {
    const startDate = new Date(`${selectedDates.start}T00:00:00`).getTime();
    const endDate = new Date(`${selectedDates.end}T23:59:59.999`).getTime();
    if (Number.isFinite(startDate) && Number.isFinite(endDate) && endDate >= startDate) {
      return clampPeriodRangeMs({ startDate, endDate });
    }
    const fallback = resolvePeriodPreset("last_7_days");
    return clampPeriodRangeMs({
      startDate: new Date(`${fallback.start}T00:00:00`).getTime(),
      endDate: new Date(`${fallback.end}T23:59:59.999`).getTime(),
    });
  }, [selectedDates.start, selectedDates.end]);
  const requestedStartMs = new Date(`${selectedDates.start}T00:00:00`).getTime();
  const rangeWasLimited = Number.isFinite(requestedStartMs) &&
    periodRange.startDate !== requestedStartMs;
  const effectiveStart = localIsoDate(new Date(periodRange.startDate));
  const effectiveEnd = localIsoDate(new Date(periodRange.endDate));
  const periodLabel = rangeWasLimited
    ? `${effectiveStart} to ${effectiveEnd}`
    : periodPresetLabel(filters.preset);
  const periodDays = Math.max(
    1,
    Math.round((periodRange.endDate - periodRange.startDate + 1) / (24 * 60 * 60 * 1000)),
  );
  const branchFilter = filters.branchFilter as Id<"branches"> | "all";
  const metric = parseTopSellingMetric(filters.topSellingMetric);
  const mirroredBranches = useBranchesList(false, Boolean(isAdmin || isManager));
  const branches = isAdmin || isManager ? mirroredBranches : undefined;
  const { data, loading, hospitality } = useDashboardData(branchFilter, periodRange);

  useEffect(() => {
    if (!isAdmin || !branches || branchFilter === "all") return;
    if (branches.some((branch) => branch.id === branchFilter)) return;
    setFilters((current) => ({ ...current, branchFilter: "all" }));
  }, [isAdmin, branches, branchFilter, setFilters]);

  if (!role || loading || !data) {
    return <LoadingState label="Loading dashboard…" />;
  }

  const showOps = data.role === "administrator" || data.role === "manager";
  // Stock / expiry KPIs are org-wide with branch tags — never pin inventory to
  // the cashier's home branch when the dashboard is showing all branches.
  const inventoryAlertHref = (kind: "low" | "expiry") => {
    const params = new URLSearchParams({ filter: kind });
    if (branchFilter !== "all") params.set("branch", String(branchFilter));
    return `/inventory?${params.toString()}`;
  };

  const kpis = [
    {
      title: showOps ? `Sales (${periodLabel})` : "Today's Sales",
      value: formatMoneyAmount(data.kpis.revenue),
      unit: CURRENCY_SYMBOL,
      icon: Wallet,
      href: "/orders",
    },
    {
      title: showOps ? `Orders (${periodLabel})` : "Today's Orders",
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
    ...(showStockOps
      ? ([
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
        ] as const)
      : []),
  ];

  const compactActions = [
    ...(showStockOps
      ? [{ key: "inventory", label: "Inventory", icon: Package, href: "/inventory" }]
      : []),
    { key: "sale", label: "New Sale", icon: ShoppingBag, href: "/sales" },
  ];

  return (
    <div className="min-w-0 space-y-6" data-tour="page-content">
      <PageHeader
        title="Dashboard"
        description={dashboardViewDescription({
          profile: industryProfile,
          showOps,
          showStockOps,
          opsWindowDays: periodDays,
          opsPeriodLabel: periodLabel,
          terms,
        })}
        compactActions={compactActions}
        actions={
          <div className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto">
            {isAdmin || isManager ? (
              <PeriodFilter
                inline
                preset={filters.preset}
                start={selectedDates.start}
                end={selectedDates.end}
                onPresetChange={(preset) =>
                  setFilters((current) => ({ ...current, preset }))
                }
                onCustomRangeChange={(next) =>
                  setFilters((current) => ({
                    ...current,
                    preset: "custom",
                    customStart: next.start,
                    customEnd: next.end,
                  }))
                }
                className="min-w-0 shrink-0"
              />
            ) : null}
            {isAdmin ? (
              <BranchFilter
                inline
                branches={branches}
                value={branchFilter}
                onChange={(next) =>
                  setFilters((current) => ({ ...current, branchFilter: String(next) }))
                }
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
            {showStockOps ? (
              <Button asChild variant="outline" className="hidden h-9 shrink-0 sm:inline-flex">
                <Link href="/inventory">Inventory</Link>
              </Button>
            ) : null}
            <Button asChild className="h-9 min-h-9 flex-1 shrink-0 sm:flex-none">
              <Link href="/sales">New Sale</Link>
            </Button>
          </div>
        }
      />

      {(isAdmin || isManager) && rangeWasLimited ? (
        <p role="status" className="border-border bg-muted text-foreground rounded-lg border p-3 text-sm">
          Dashboard ranges are limited to 370 days. Showing {effectiveStart} to {effectiveEnd},
          rather than the full selected range. Choose a shorter range to show all selected dates.
        </p>
      ) : null}

      {/* Mobile: 2×3 bento grid (hero KPI spans 2 cols) · Desktop: row */}
      <div className="md:hidden">
        <KpiBentoGrid kpis={kpis} />
      </div>
      <div className="hidden md:block">
        {/* Five KPIs in one row only from xl — at lg each value had ~95px. */}
        <Grid
          cols={showStockOps ? 5 : 3}
          className={showStockOps ? "lg:grid-cols-3 xl:grid-cols-5" : undefined}
        >
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </Grid>
      </div>

      <HospitalityOpsCards hospitality={hospitality} terms={terms} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Card className="min-w-0 overflow-hidden xl:col-span-2">
          <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <CardTitle>
              {showOps ? `Sales Overview (${periodLabel})` : "Sales Overview"}
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
              <TopSellingMetricToggle value={metric} onChange={(next) =>
                setFilters((current) => ({ ...current, topSellingMetric: next }))
              } />
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
              <TopSellingMetricToggle value={metric} onChange={(next) =>
                setFilters((current) => ({ ...current, topSellingMetric: next }))
              } />
            </CardHeader>
            <CardContent>
              <TopSellingList products={data.topProducts} metric={metric} bordered />
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Recent Sales</CardTitle>
              <Button asChild size="sm" variant="ghost">
                <Link href="/orders">All orders</Link>
              </Button>
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
            <Button asChild size="sm" variant="ghost">
              <Link href="/orders">All orders</Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <RecentSalesTable sales={data.recentSales} />
          </CardContent>
        </Card>
      )}

      {showOps && showStockOps ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Low stock</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {data.lowStock.length > 0 ? (
                  <Badge variant="warning">{data.kpis.lowStockCount} across branches</Badge>
                ) : null}
                <Button asChild size="sm" variant="ghost">
                  <Link href={inventoryAlertHref("low")}>Inventory</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <StockAlertList
                rows={data.lowStock}
                emptyTitle="No low stock"
                emptyDescription="Branch stock is above thresholds."
                kind="low"
              />
            </CardContent>
          </Card>
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Expiring / expired</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {(data.kpis.expiringCount ?? 0) > 0 ? (
                  <Badge variant="destructive">{data.kpis.expiringCount} across branches</Badge>
                ) : null}
                <Button asChild size="sm" variant="ghost">
                  <Link href={inventoryAlertHref("expiry")}>Inventory</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <StockAlertList
                rows={(data.expiryAlerts ?? []).map((row) => ({
                  id: row.id,
                  productId: row.productId,
                  name: row.name,
                  stockQuantity:
                    (row.isExpired ? row.expiredQuantity : 0) +
                    (row.isExpiring ? row.sellableQuantity : 0),
                  unit: row.unit,
                  lowStockThreshold: 0,
                  branchId: row.branchId,
                  branchName: row.branchName,
                  badge:
                    row.isExpired && row.isExpiring
                      ? "Expired + expiring"
                      : row.isExpired
                        ? "Expired"
                        : "Expiring",
                  detail: row.nearestExpiry ?? undefined,
                }))}
                emptyTitle="No expiry alerts"
                emptyDescription="No expired or soon-to-expire lots across branches."
                kind="expiry"
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
