import type { DateRangePreset } from "@/lib/date";
import { toLocalDateInput } from "@/lib/date";

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
  { value: "card", label: "Card" },
  { value: "mobile_money", label: "Mobile money" },
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
  };
}

export function parseAmountInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return amount;
}

export function hasActiveOrdersFilters(filters: OrdersFilterState) {
  return (
    Boolean(filters.search.trim()) ||
    filters.branchId !== "all" ||
    filters.cashierId !== "all" ||
    filters.datePreset !== "all" ||
    Boolean(filters.minAmount.trim()) ||
    Boolean(filters.maxAmount.trim()) ||
    filters.paymentMethod !== "all" ||
    filters.returnStatus !== "all"
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
