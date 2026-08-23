"use client";

import { Activity, CreditCard, Receipt, TrendingUp } from "lucide-react";
import { PlatformPlaceholderView } from "@/features/platform/components/platform-placeholder-view";

export function PlatformRevenueView() {
  return (
    <PlatformPlaceholderView
      title="Revenue"
      description="Subscription revenue, plan mix, renewals, and churn for the Novend platform."
      icon={TrendingUp}
      emptyTitle="Revenue analytics coming next"
      emptyDescription="MRR, ARR, plan distribution, and profit trends will land here as the Super Admin console expands."
    />
  );
}

export function PlatformCostsView() {
  return (
    <PlatformPlaceholderView
      title="Operating costs"
      description="Track hosting, Convex, Vercel, domains, SMS, email, and other platform expenses."
      icon={Receipt}
      emptyTitle="Cost tracking coming next"
      emptyDescription="Record operating costs here so the dashboard can calculate gross revenue, expenses, and net profit."
    />
  );
}

export function PlatformSubscriptionsView() {
  return (
    <PlatformPlaceholderView
      title="Subscriptions"
      description="Manage organization plans, renewals, invoices, and license status across tenants."
      icon={CreditCard}
      emptyTitle="Subscription manager coming next"
      emptyDescription="A full SaaS subscription table with plan edits, extensions, and suspend actions will live here."
    />
  );
}

export function PlatformHealthView() {
  return (
    <PlatformPlaceholderView
      title="System health"
      description="Monitor Convex, storage, sync queues, release versions, and connected devices."
      icon={Activity}
      emptyTitle="Health monitoring coming next"
      emptyDescription="Platform status, sync failures, and connected desktop or mobile devices will appear here."
    />
  );
}
