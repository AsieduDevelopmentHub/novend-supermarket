export type ExpenseCategory =
  "salaries" | "commissions" | "transport" | "utilities" | "supplies" | "maintenance" | "misc";

export const EXPENSE_CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "salaries", label: "Employee salaries" },
  { value: "commissions", label: "Staff commissions" },
  { value: "transport", label: "Transportation & travel" },
  { value: "utilities", label: "Utilities" },
  { value: "supplies", label: "Office supplies" },
  { value: "maintenance", label: "Maintenance & repairs" },
  { value: "misc", label: "Miscellaneous" },
];

/** Categories available in the manual "Record expense" form — payroll uses Users → detail. */
export const MANUAL_EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORY_OPTIONS.filter(
  (option) => option.value !== "salaries" && option.value !== "commissions",
);

export function expenseCategoryLabel(category: string) {
  return EXPENSE_CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
}
