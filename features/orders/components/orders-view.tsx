"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useBranchesList, useOrdersList, useUsersList } from "@/hooks/use-offline-lists";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, rangeForDatePreset, type DateRangePreset } from "@/lib/date";
import {
  defaultOrdersFilters,
  hasActiveOrdersFilters,
  ORDER_DATE_PRESETS,
  parseAmountInput,
  PAYMENT_FILTER_OPTIONS,
  RETURN_STATUS_OPTIONS,
  type PaymentFilter,
  type ReturnStatusFilter,
} from "@/features/orders/constants";
import { Eye, ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";

type OrderListRow = {
  id: string;
  invoiceNumber: string;
  completedAt: number;
  customerName: string;
  cashierName: string;
  branchName?: string | null;
  paymentMethod: string;
  itemCount: number;
  total: number;
  refundedAmount?: number;
};

function OrderMobileCard({ order }: { order: OrderListRow }) {
  const [expanded, setExpanded] = useState(false);
  const returned = "refundedAmount" in order && Number(order.refundedAmount) > 0;

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
            <p className="text-muted-foreground text-xs capitalize">
              {order.paymentMethod.replace("_", " ")} · {order.itemCount} items
            </p>
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

export function OrdersView() {
  const { isAdmin, isManager, isCashier, branchId: myBranchId, branchName } = usePermissions();
  const { user } = useCurrentUser();
  const [filters, setFilters] = useState(defaultOrdersFilters);
  const branches = useBranchesList(false);
  const staff = useUsersList("", isAdmin || isManager);

  const dateRange = useMemo(
    () => rangeForDatePreset(filters.datePreset, filters.customStart, filters.customEnd),
    [filters.datePreset, filters.customStart, filters.customEnd],
  );
  const minTotal = parseAmountInput(filters.minAmount);
  const maxTotal = parseAmountInput(filters.maxAmount);
  const amountRangeInvalid =
    minTotal !== undefined && maxTotal !== undefined && maxTotal < minTotal;

  const { orders } = useOrdersList({
    search: filters.search,
    branchId: isAdmin && filters.branchId !== "all" ? (filters.branchId as Id<"branches">) : undefined,
    cashierId:
      !isCashier && filters.cashierId !== "all" ? (filters.cashierId as Id<"users">) : undefined,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    minTotal: amountRangeInvalid ? undefined : minTotal,
    maxTotal: amountRangeInvalid ? undefined : maxTotal,
    paymentMethod: filters.paymentMethod === "all" ? undefined : filters.paymentMethod,
    returnStatus: filters.returnStatus === "all" ? undefined : filters.returnStatus,
  });

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Find a completed sale by day, cashier, amount, payment, or invoice."
        actions={
          <Button asChild>
            <Link href="/sales">New Sale</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="w-full space-y-1 sm:max-w-md">
            <Label htmlFor="orders-search">Search</Label>
            <Input
              id="orders-search"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Invoice, customer, or cashier…"
            />
          </div>

          <CollapsibleFilters
            activeCount={
              [
                filters.branchId !== "all",
                filters.cashierId !== "all",
                filters.datePreset !== "7d",
                Boolean(filters.minAmount.trim()),
                Boolean(filters.maxAmount.trim()),
                filters.paymentMethod !== "all",
                filters.returnStatus !== "all",
              ].filter(Boolean).length
            }
            onReset={resetFilters}
          >
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

          {filters.datePreset === "custom" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="orders-start">From</Label>
                <Input
                  id="orders-start"
                  type="date"
                  value={filters.customStart}
                  onChange={(e) => setFilters((prev) => ({ ...prev, customStart: e.target.value }))}
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

          {isCashier ? (
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
          )}

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
                setFilters((prev) => ({ ...prev, returnStatus: value as ReturnStatusFilter }))
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
          </CollapsibleFilters>
        </CardContent>
      </Card>

      {amountRangeInvalid ? (
        <p className="text-destructive text-sm">Maximum amount must be at least the minimum.</p>
      ) : null}

      {orders === undefined ? (
        <LoadingState label="Loading orders…" variant="table" />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={filtersActive ? "No orders match these filters" : "No orders yet"}
          description={
            filtersActive
              ? "Try a wider date range, clear the amount, or reset filters."
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
          <p className="text-muted-foreground text-sm">
            {orders.length === 1 ? "1 order" : `${orders.length} orders`}
            {filters.datePreset !== "all"
              ? ` · ${ORDER_DATE_PRESETS.find((p) => p.value === filters.datePreset)?.label}`
              : ""}
          </p>
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
                    {orders.map((order) => (
                      <ClickableTableRow key={order.id} href={`/orders/${order.id}`}>
                        <td className="px-4 py-3 font-medium">{order.invoiceNumber}</td>
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
                        <td className="px-4 py-3 capitalize">
                          {order.paymentMethod.replace("_", " ")}
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
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3 md:hidden">
            {orders.map((order) => (
              <OrderMobileCard key={order.id} order={order} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
