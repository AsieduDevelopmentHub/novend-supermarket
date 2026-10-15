"use client";

import { FULLY_OFFLINE } from "@/constants/runtime";
import { CustomerDisplayView } from "@/features/customer-display/components/customer-display-view";
import { PlanCapabilityGate } from "@/features/billing/components/plan-capability-gate";

export default function CustomerDisplayPage() {
  if (FULLY_OFFLINE) {
    return <CustomerDisplayView />;
  }
  return (
    <PlanCapabilityGate
      capability="canUseCustomerDisplay"
      title="Customer display"
      description="Show cart items, discounts, and totals on a customer-facing screen."
    >
      <CustomerDisplayView />
    </PlanCapabilityGate>
  );
}
