export const RETURN_REASON_OPTIONS = [
  { value: "Damaged product", label: "Damaged product" },
  { value: "Wrong item", label: "Wrong item" },
  { value: "Customer changed mind", label: "Customer changed mind" },
  { value: "Quality issue", label: "Quality issue" },
  { value: "Other", label: "Other" },
] as const;

export type ReturnReason = (typeof RETURN_REASON_OPTIONS)[number]["value"];
