export type ExpenseCategory =
  "salaries" | "transport" | "utilities" | "supplies" | "maintenance" | "misc";

export const EXPENSE_CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "salaries", label: "Employee salaries" },
  { value: "transport", label: "Transportation & travel" },
  { value: "utilities", label: "Utilities" },
  { value: "supplies", label: "Office supplies" },
  { value: "maintenance", label: "Maintenance & repairs" },
  { value: "misc", label: "Miscellaneous" },
];

export function expenseCategoryLabel(category: string) {
  return EXPENSE_CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
}
