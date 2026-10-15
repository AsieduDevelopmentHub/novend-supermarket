import type { DateRangePreset } from "@/lib/date";
import { toLocalDateInput } from "@/lib/date";
import type { OpenOperationSource } from "@/features/orders/open-operations";

export const ORDERS_ACTIVITY_TABS = [
  { value: "all", label: "All activity" },
  { value: "open", label: "Open operations" },
  { value: "completed", label: "Completed sales" },
] as const;

export type OrdersActivityTab = (typeof ORDERS_ACTIVITY_TABS)[number]["value"];

export const OPEN_OPERATION_SOURCE_FILTERS: {
  value: "all" | OpenOperationSource;
  label: string;
}[] = [
  { value: "all", label: "All sources" },
  { value: "restaurant_table", label: "Table check" },
  { value: "bar_tab", label: "Bar tab" },
  { value: "room_folio", label: "Room folio" },
  { value: "reservation", label: "Reservation" },
];

export const OPEN_OPERATION_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
] as const;

export const ORDER_DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom dates" },
  { value: "all", label: "All dates" },
];

export const PAYMENT_FILTER_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "MoMo" },
  { value: "card", label: "Card" },
] as const;

export const RETURN_STATUS_OPTIONS = [
  { value: "all", label: "All orders" },
  { value: "none", label: "No return" },
  { value: "returned", label: "Returned" },
] as const;

export type PaymentFilter = (typeof PAYMENT_FILTER_OPTIONS)[number]["value"];
export type ReturnStatusFilter = (typeof RETURN_STATUS_OPTIONS)[number]["value"];

export type OrdersFilterState = {
  search: string;
  branchId: "all" | string;
  cashierId: "all" | string;
  datePreset: DateRangePreset;
  customStart: string;
  customEnd: string;
  minAmount: string;
  maxAmount: string;
  paymentMethod: PaymentFilter;
  returnStatus: ReturnStatusFilter;
  activityTab: OrdersActivityTab;
  operationSource: "all" | OpenOperationSource;
  operationStatus: (typeof OPEN_OPERATION_STATUS_FILTERS)[number]["value"];
};

export function defaultOrdersFilters(): OrdersFilterState {
  const today = toLocalDateInput();
  return {
    search: "",
    branchId: "all",
    cashierId: "all",
    datePreset: "7d",
    customStart: today,
    customEnd: today,
    minAmount: "",
    maxAmount: "",
    paymentMethod: "all",
    returnStatus: "all",
    activityTab: "completed",
    operationSource: "all",
    operationStatus: "all",
  };
}

export function parseAmountInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return amount;
}

export function hasAdvancedOrdersFilters(filters: OrdersFilterState) {
  return (
    filters.branchId !== "all" ||
    filters.cashierId !== "all" ||
    filters.datePreset !== "7d" ||
    Boolean(filters.minAmount.trim()) ||
    Boolean(filters.maxAmount.trim()) ||
    filters.paymentMethod !== "all" ||
    filters.returnStatus !== "all"
  );
}

export function hasActiveOrdersFilters(filters: OrdersFilterState) {
  return (
    Boolean(filters.search.trim()) ||
    hasAdvancedOrdersFilters(filters) ||
    filters.datePreset !== "all"
  );
}

export const RETURN_REASON_OPTIONS = [
  { value: "Damaged product", label: "Damaged product" },
  { value: "Wrong item", label: "Wrong item" },
  { value: "Customer changed mind", label: "Customer changed mind" },
  { value: "Quality issue", label: "Quality issue" },
  { value: "Other", label: "Other" },
] as const;

export type ReturnReason = (typeof RETURN_REASON_OPTIONS)[number]["value"];
