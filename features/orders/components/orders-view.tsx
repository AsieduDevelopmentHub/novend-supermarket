"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { BranchFilter } from "@/components/filters/branch-filter";
import { CashierFilter } from "@/components/filters/cashier-filter";
import { CollapsibleFilters } from "@/components/filters/collapsible-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useBranchesList, useOrdersList, useUsersList } from "@/hooks/use-offline-lists";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { ListPagination } from "@/components/ui/list-pagination";
import { useClientPagedRows } from "@/hooks/use-ui";
import { formatCurrency } from "@/lib/currency";
import { paymentMethodLabel } from "@/lib/payments";
import { formatDateTime, rangeForDatePreset, type DateRangePreset } from "@/lib/date";
import { listLocalOpenOperations } from "@/lib/offline/mirror-queries";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { pickLiveListWhenOnline } from "@/lib/offline/list-preference";
import {
  filterOpenOperations,
  sortOpenOperationsNewestFirst,
  type OpenOperationRow,
  type OpenOperationSource,
} from "@/features/orders/open-operations";
import { Plus, Eye, ChevronDown, ChevronUp, ShoppingBag, UtensilsCrossed } from "lucide-react";
import {
  defaultOrdersFilters,
  hasActiveOrdersFilters,
  ORDER_DATE_PRESETS,
  ORDERS_ACTIVITY_TABS,
  OPEN_OPERATION_SOURCE_FILTERS,
  OPEN_OPERATION_STATUS_FILTERS,
  parseAmountInput,
  PAYMENT_FILTER_OPTIONS,
  RETURN_STATUS_OPTIONS,
  type OrdersActivityTab,
  type PaymentFilter,
  type ReturnStatusFilter,
} from "@/features/orders/constants";

type OrderListRow = {
  id: string;
  invoiceNumber: string;
  completedAt: number;
  customerName: string;
  cashierName: string;
  branchName?: string | null;
  paymentMethod: string;
  amountPaid?: number;
  changeGiven?: number;
  itemCount: number;
  total: number;
  refundedAmount?: number;
  customerId?: string | null;
};

function tenderCashLines(order: Pick<OrderListRow, "amountPaid" | "changeGiven">) {
  if (typeof order.amountPaid !== "number") return null;
  return `Paid ${formatCurrency(order.amountPaid)} · Change ${formatCurrency(order.changeGiven ?? 0)}`;
}

function sourceLabel(source: OpenOperationSource) {
  switch (source) {
    case "bar_tab":
      return "Bar tab";
    case "room_folio":
      return "Room folio";
    case "reservation":
      return "Reservation";
    default:
      return "Table check";
  }
}

function OrderMobileCard({ order }: { order: OrderListRow }) {
  const [expanded, setExpanded] = useState(false);
  const returned = "refundedAmount" in order && Number(order.refundedAmount) > 0;
  const cashLines = tenderCashLines(order);

  return (
    <Card className="overflow-hidden rounded-[20px]">
      <CardContent className="space-y-2 p-4">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <p className="font-semibold">{order.invoiceNumber}</p>
            <p className="text-muted-foreground text-xs">{formatDateTime(order.completedAt)}</p>
            <p className="mt-1 truncate text-sm">{order.customerName}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">Direct POS</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex flex-wrap justify-end gap-1">
              <Badge variant="success">Completed</Badge>
              {returned ? <Badge variant="warning">Returned</Badge> : null}
            </div>
            <p className="text-sm font-semibold">{formatCurrency(order.total)}</p>
            {expanded ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </div>
        </button>
        {expanded ? (
          <div className="border-border space-y-3 border-t pt-3">
            <p className="text-muted-foreground text-xs">
              {order.branchName ? `${order.branchName} · ` : ""}
              Cashier: {order.cashierName}
            </p>
            <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              <Badge variant="secondary">{paymentMethodLabel(order.paymentMethod)}</Badge>
              <span>{order.itemCount} items</span>
            </p>
            {cashLines ? <p className="text-muted-foreground text-xs">{cashLines}</p> : null}
            <Button asChild size="sm" variant="outline" className="min-h-11 w-full">
              <Link href={`/orders/${order.id}`}>
                <Eye className="h-4 w-4" />
                View details · Print / Share
              </Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OpenOperationMobileCard({ row }: { row: OpenOperationRow }) {
  return (
    <Card className="overflow-hidden rounded-[20px]">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{row.originLabel}</p>
            <p className="text-muted-foreground text-xs">{formatDateTime(row.openedAt)}</p>
            <p className="mt-1 truncate text-sm">{row.guestLabel ?? "—"}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{sourceLabel(row.source)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="warning">{row.status}</Badge>
            {row.fulfilmentStatus ? <Badge variant="secondary">{row.fulfilmentStatus}</Badge> : null}
            <p className="text-sm font-semibold">{formatCurrency(row.total)}</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="min-h-11 w-full">
          <Link href={row.href}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function useOpenOperationsList(options: {
  branchId?: Id<"branches">;
  enabled: boolean;
}) {
  const online = useConnectivity();
  const { industryProfile } = useBusinessCapabilities();
  const [local, setLocal] = useState<OpenOperationRow[] | null>(null);
  const remote = useAuthedQuery(
    api.operations.listOpenOperations,
    online && options.enabled
      ? {
          branchId: options.branchId,
          includeReservations: true,
        }
      : "skip",
  );

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listLocalOpenOperations({
        branchId: options.branchId,
        industryProfile,
      }).then((rows) => {
        if (!cancelled) setLocal(rows);
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [options.branchId, industryProfile, remote]);

  const rows = pickLiveListWhenOnline({
    local,
    remote: remote as OpenOperationRow[] | undefined,
    online,
  });
  return {
    operations: rows ?? undefined,
    loading: rows === undefined,
  };
}

export function OrdersView() {
  const { isAdmin, isManager, isCashier, branchId: myBranchId, branchName } = usePermissions();
  const { user } = useCurrentUser();
  const { hasCapability } = useBusinessCapabilities();
  const hospitalityOrders =
    hasCapability("tables_orders") ||
    hasCapability("rooms_folio") ||
    hasCapability("reservations");
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => {
    const defaults = defaultOrdersFilters();
    const cashierId = searchParams.get("cashierId");
    const tab = searchParams.get("tab") as OrdersActivityTab | null;
    return {
      ...defaults,
      ...(cashierId ? { cashierId } : {}),
      ...(tab && ORDERS_ACTIVITY_TABS.some((t) => t.value === tab) ? { activityTab: tab } : {}),
    };
  });
  const branches = useBranchesList(false);
  const staff = useUsersList("", isAdmin || isManager);

  useEffect(() => {
    if (hospitalityOrders) return;
    if (filters.activityTab === "completed") return;
    setFilters((prev) => ({ ...prev, activityTab: "completed" }));
  }, [hospitalityOrders, filters.activityTab]);

  const dateRange = useMemo(
    () => rangeForDatePreset(filters.datePreset, filters.customStart, filters.customEnd),
    [filters.datePreset, filters.customStart, filters.customEnd],
  );
  const minTotal = parseAmountInput(filters.minAmount);
  const maxTotal = parseAmountInput(filters.maxAmount);
  const amountRangeInvalid =
    minTotal !== undefined && maxTotal !== undefined && maxTotal < minTotal;

  const showCompleted =
    !hospitalityOrders ||
    filters.activityTab === "all" ||
    filters.activityTab === "completed";
  const showOpen =
    hospitalityOrders &&
    (filters.activityTab === "all" || filters.activityTab === "open");

  const { orders } = useOrdersList({
    search: filters.search,
    branchId:
      isAdmin && filters.branchId !== "all" ? (filters.branchId as Id<"branches">) : undefined,
    cashierId:
      !isCashier && filters.cashierId !== "all" ? (filters.cashierId as Id<"users">) : undefined,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    minTotal: amountRangeInvalid ? undefined : minTotal,
    maxTotal: amountRangeInvalid ? undefined : maxTotal,
    paymentMethod: filters.paymentMethod === "all" ? undefined : filters.paymentMethod,
    returnStatus: filters.returnStatus === "all" ? undefined : filters.returnStatus,
  });

  const openBranchId =
    isAdmin && filters.branchId !== "all"
      ? (filters.branchId as Id<"branches">)
      : !isAdmin
        ? (myBranchId as Id<"branches"> | undefined)
        : undefined;

  const { operations: openOpsRaw, loading: openLoading } = useOpenOperationsList({
    branchId: openBranchId,
    enabled: showOpen,
  });

  const openOperations = useMemo(() => {
    if (!openOpsRaw) return undefined;
    return sortOpenOperationsNewestFirst(
      filterOpenOperations(openOpsRaw, {
        branchId: filters.branchId,
        source: filters.operationSource,
        status: filters.operationStatus,
        search: filters.search,
      }),
    );
  }, [
    openOpsRaw,
    filters.branchId,
    filters.operationSource,
    filters.operationStatus,
    filters.search,
  ]);

  const {
    paged: pageRows,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
  } = useClientPagedRows(
    showCompleted ? orders : [],
    `${filters.search}|${filters.branchId}|${filters.cashierId}|${filters.datePreset}|${filters.paymentMethod}|${filters.returnStatus}|${filters.minAmount}|${filters.maxAmount}|${filters.activityTab}`,
  );

  const cashiers = useMemo(() => {
    if (!staff) return undefined;
    return staff
      .map((row) => ({
        userId: row.userId as Id<"users">,
        name: row.status === "inactive" ? `${row.name} (inactive)` : row.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff]);

  const filtersActive = hasActiveOrdersFilters(filters);

  function resetFilters() {
    setFilters(defaultOrdersFilters());
  }

  const completedLoading = showCompleted && orders === undefined;
  const openOpsLoading = showOpen && openLoading;
  const listLoading = completedLoading || openOpsLoading;

  const hasOpen = (openOperations?.length ?? 0) > 0;
  const hasCompleted = showCompleted && (orders?.length ?? 0) > 0;
  const empty =
    !listLoading &&
    !hasOpen &&
    !(showCompleted && hasCompleted) &&
    !(filters.activityTab === "completed" && hasCompleted);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={
          hospitalityOrders
            ? "Open table checks, room folios, and reservations alongside completed sales."
            : "Completed sales and receipts for this store."
        }
        compactActions={[{ key: "sale", label: "New Sale", icon: Plus, href: "/sales" }]}
        actions={
          <Button asChild>
            <Link href="/sales">New Sale</Link>
          </Button>
        }
      />

      {hospitalityOrders ? (
        <Tabs
          value={filters.activityTab}
          onValueChange={(value) =>
            setFilters((prev) => ({ ...prev, activityTab: value as OrdersActivityTab }))
          }
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {ORDERS_ACTIVITY_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-1 sm:flex-none">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <Card>
        <CardContent className="p-4">
          <CollapsibleFilters
            leading={
              <div className="space-y-1">
                <Label htmlFor="orders-search">Search</Label>
                <Input
                  id="orders-search"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder={
                    showOpen && !showCompleted
                      ? "Table, room, guest, or reservation…"
                      : hospitalityOrders
                        ? "Invoice, customer, cashier, table, or room…"
                        : "Invoice, customer, or cashier…"
                  }
                />
              </div>
            }
            activeCount={
              [
                filters.branchId !== "all",
                filters.cashierId !== "all",
                filters.datePreset !== "7d",
                Boolean(filters.minAmount.trim()),
                Boolean(filters.maxAmount.trim()),
                filters.paymentMethod !== "all",
                filters.returnStatus !== "all",
                filters.operationSource !== "all",
                filters.operationStatus !== "all",
              ].filter(Boolean).length
            }
            onReset={resetFilters}
          >
            {showOpen ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="orders-op-source">Source</Label>
                  <Select
                    value={filters.operationSource}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        operationSource: value as typeof filters.operationSource,
                      }))
                    }
                  >
                    <SelectTrigger id="orders-op-source" className="w-full sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPEN_OPERATION_SOURCE_FILTERS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="orders-op-status">Op status</Label>
                  <Select
                    value={filters.operationStatus}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        operationStatus: value as typeof filters.operationStatus,
                      }))
                    }
                  >
                    <SelectTrigger id="orders-op-status" className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPEN_OPERATION_STATUS_FILTERS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {showCompleted ? (
              <div className="space-y-1">
                <Label htmlFor="orders-date-preset">Date</Label>
                <Select
                  value={filters.datePreset}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, datePreset: value as DateRangePreset }))
                  }
                >
                  <SelectTrigger id="orders-date-preset" className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_DATE_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {showCompleted && filters.datePreset === "custom" ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="orders-start">From</Label>
                  <Input
                    id="orders-start"
                    type="date"
                    value={filters.customStart}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, customStart: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="orders-end">To</Label>
                  <Input
                    id="orders-end"
                    type="date"
                    value={filters.customEnd}
                    onChange={(e) => setFilters((prev) => ({ ...prev, customEnd: e.target.value }))}
                  />
                </div>
              </>
            ) : null}

            {isAdmin ? (
              <BranchFilter
                branches={branches}
                value={filters.branchId === "all" ? "all" : (filters.branchId as Id<"branches">)}
                onChange={(value) => setFilters((prev) => ({ ...prev, branchId: value }))}
                allowAll
                className="w-full sm:w-auto"
              />
            ) : branchName ? (
              <BranchFilter
                branches={undefined}
                value={myBranchId}
                onChange={() => undefined}
                lockedLabel={branchName}
                className="w-full sm:w-auto"
              />
            ) : null}

            {showCompleted ? (
              isCashier ? (
                <CashierFilter
                  cashiers={undefined}
                  value={null}
                  onChange={() => undefined}
                  lockedLabel={user?.name ?? "You"}
                  className="w-full sm:w-auto"
                />
              ) : (
                <CashierFilter
                  cashiers={cashiers}
                  value={filters.cashierId === "all" ? "all" : (filters.cashierId as Id<"users">)}
                  onChange={(value) => setFilters((prev) => ({ ...prev, cashierId: value }))}
                  className="w-full sm:w-auto"
                />
              )
            ) : null}

            {showCompleted ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="orders-min">Min amount</Label>
                  <Input
                    id="orders-min"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="0"
                    className="w-full sm:w-32"
                    value={filters.minAmount}
                    onChange={(e) => setFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="orders-max">Max amount</Label>
                  <Input
                    id="orders-max"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="Any"
                    className="w-full sm:w-32"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="orders-payment">Payment</Label>
                  <Select
                    value={filters.paymentMethod}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, paymentMethod: value as PaymentFilter }))
                    }
                  >
                    <SelectTrigger id="orders-payment" className="w-full sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="orders-return">Returns</Label>
                  <Select
                    value={filters.returnStatus}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        returnStatus: value as ReturnStatusFilter,
                      }))
                    }
                  >
                    <SelectTrigger id="orders-return" className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
          </CollapsibleFilters>
        </CardContent>
      </Card>

      {amountRangeInvalid ? (
        <p className="text-destructive text-sm">Maximum amount must be at least the minimum.</p>
      ) : null}

      {listLoading ? (
        <LoadingState label="Loading orders…" variant="table" />
      ) : empty ? (
        <EmptyState
          icon={filters.activityTab === "open" ? UtensilsCrossed : ShoppingBag}
          title={
            filtersActive
              ? "No records match these filters"
              : filters.activityTab === "open"
                ? "No open operations"
                : "No orders yet"
          }
          description={
            filtersActive
              ? "Try a wider date range, clear the amount, or reset filters."
              : filters.activityTab === "open"
                ? "Open table checks, room folios, and upcoming reservations appear here."
                : "Completed sales will appear here."
          }
          action={
            filtersActive ? (
              <Button type="button" variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {showOpen && hasOpen ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {openOperations!.length === 1
                  ? "1 open operation"
                  : `${openOperations!.length} open operations`}
              </p>
              <div className="hidden md:block">
                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full min-w-[960px] text-left text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Origin</th>
                          <th className="px-4 py-3 font-medium">Opened</th>
                          <th className="px-4 py-3 font-medium">Branch</th>
                          <th className="px-4 py-3 font-medium">Guest</th>
                          <th className="px-4 py-3 font-medium">Server</th>
                          <th className="px-4 py-3 font-medium">Items</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openOperations!.map((row) => (
                          <ClickableTableRow key={`op-${row.kind}-${row.id}`} href={row.href}>
                            <td className="px-4 py-3">
                              <div className="font-medium">{row.originLabel}</div>
                              <div className="text-muted-foreground text-xs">
                                {sourceLabel(row.source)}
                              </div>
                            </td>
                            <td className="px-4 py-3">{formatDateTime(row.openedAt)}</td>
                            <td className="px-4 py-3">{row.branchName ?? "—"}</td>
                            <td className="px-4 py-3">{row.guestLabel ?? "—"}</td>
                            <td className="px-4 py-3">{row.serverName ?? "—"}</td>
                            <td className="px-4 py-3">{row.itemCount}</td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(row.total)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="warning">{row.status}</Badge>
                                {row.fulfilmentStatus ? (
                                  <Badge variant="secondary">{row.fulfilmentStatus}</Badge>
                                ) : null}
                                <Badge variant="outline">Unpaid</Badge>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Button asChild size="icon" variant="ghost" aria-label="Open">
                                <Link href={row.href}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            </td>
                          </ClickableTableRow>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-3 md:hidden">
                {openOperations!.map((row) => (
                  <OpenOperationMobileCard key={`op-m-${row.kind}-${row.id}`} row={row} />
                ))}
              </div>
            </div>
          ) : null}

          {showCompleted && hasCompleted ? (
            <div className="space-y-3">
              {showOpen ? (
                <p className="text-muted-foreground text-sm font-medium">Completed sales</p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {orders!.length === 1 ? "1 order" : `${orders!.length} orders`}
                  {filters.datePreset !== "all"
                    ? ` · ${ORDER_DATE_PRESETS.find((p) => p.value === filters.datePreset)?.label}`
                    : ""}
                </p>
              )}
              <div className="hidden md:block">
                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full min-w-[960px] text-left text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Invoice</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Branch</th>
                          <th className="px-4 py-3 font-medium">Customer</th>
                          <th className="px-4 py-3 font-medium">Cashier</th>
                          <th className="px-4 py-3 font-medium">Items</th>
                          <th className="px-4 py-3 font-medium">Payment</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pageRows ?? []).map((order) => {
                          const cashLines = tenderCashLines(order);
                          return (
                          <ClickableTableRow key={order.id} href={`/orders/${order.id}`}>
                            <td className="px-4 py-3">
                              <div className="font-medium">{order.invoiceNumber}</div>
                              <div className="text-muted-foreground text-xs">Direct POS</div>
                            </td>
                            <td className="px-4 py-3">{formatDateTime(order.completedAt)}</td>
                            <td className="px-4 py-3">{order.branchName ?? "—"}</td>
                            <td className="px-4 py-3">
                              {order.customerId ? (
                                <Link
                                  href={`/customers/${order.customerId}`}
                                  className="hover:underline"
                                >
                                  {order.customerName}
                                </Link>
                              ) : (
                                order.customerName
                              )}
                            </td>
                            <td className="px-4 py-3">{order.cashierName}</td>
                            <td className="px-4 py-3">{order.itemCount}</td>
                            <td className="px-4 py-3">
                              <div className="space-y-0.5">
                                <Badge variant="secondary">
                                  {paymentMethodLabel(order.paymentMethod)}
                                </Badge>
                                {cashLines ? (
                                  <p className="text-muted-foreground text-xs">{cashLines}</p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(order.total)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="success">Completed</Badge>
                                {"refundedAmount" in order && Number(order.refundedAmount) > 0 ? (
                                  <Badge variant="warning">Returned</Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                asChild
                                size="icon"
                                variant="ghost"
                                aria-label="View order details"
                              >
                                <Link href={`/orders/${order.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            </td>
                          </ClickableTableRow>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3 md:hidden">
                {(pageRows ?? []).map((order) => (
                  <OrderMobileCard key={order.id} order={order} />
                ))}
              </div>
              {total > 0 ? (
                <ListPagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
