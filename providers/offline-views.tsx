"use client";

import { Suspense, type ReactNode } from "react";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { SalesView } from "@/features/sales/components/sales-view";
import { OrdersView } from "@/features/orders/components/orders-view";
import { OrderDetailView } from "@/features/orders/components/order-detail-view";
import { InventoryView } from "@/features/inventory/components/inventory-view";
import { ProductsView } from "@/features/products/components/products-view";
import { CustomersView } from "@/features/customers/components/customers-view";
import { ReportsView } from "@/features/reports/components/reports-view";
import { ReportMetricDetailView } from "@/features/reports/components/metric-detail-view";
import { ReportDayDetailView } from "@/features/reports/components/day-detail-view";
import { SettingsView } from "@/features/settings/components/settings-view";
import { CustomerDisplayView } from "@/features/customer-display/components/customer-display-view";
import { MoreView } from "@/features/more/components/more-view";
import { AboutNovendView } from "@/features/settings/components/about-novend-view";
import { UsersView } from "@/features/users/components/users-view";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { AnalyticsMetricDetailView } from "@/features/analytics/components/metric-detail-view";
import { BranchesView } from "@/features/branches/components/branches-view";
import { ReturnsView } from "@/features/returns/components/returns-view";
import { ReturnDetailView } from "@/features/returns/components/return-detail-view";
import { BranchDetailView } from "@/features/branches/components/branch-detail-view";
import { WholesaleView } from "@/features/wholesale/components/wholesale-view";
import { SuppliersView } from "@/features/suppliers/components/suppliers-view";
import { DiningFloorView } from "@/features/dining/components/dining-floor-view";
import { KitchenView } from "@/features/dining/components/kitchen-view";
import { RoomsBoardView } from "@/features/hotel/components/rooms-board-view";
import { ReservationsView } from "@/features/hotel/components/reservations-view";
import { CustomerDetailView } from "@/features/customers/components/customer-detail-view";
import { ProductDetailView } from "@/features/products/components/product-detail-view";
import { UserDetailView } from "@/features/users/components/user-detail-view";
import { PlatformMonitoringView } from "@/features/platform/components/platform-monitoring-view";
import { PlatformOverviewView } from "@/features/platform/components/platform-overview-view";
import { PlatformActivityView } from "@/features/platform/components/platform-activity-view";
import { PlatformExportsView } from "@/features/platform/components/platform-exports-view";
import { PlatformHelpView } from "@/features/platform/components/platform-help-view";
import { PlatformView } from "@/features/platform/components/platform-view";
import { PlatformReleasesView } from "@/features/platform/components/platform-releases-view";
import { PlatformOrgDetailView } from "@/features/platform/components/platform-org-detail-view";
import { PlatformCostsView } from "@/features/platform/components/platform-costs-view";
import { PlatformRevenueView } from "@/features/platform/components/platform-revenue-view";
import { PlatformSubscriptionsView } from "@/features/platform/components/platform-subscriptions-view";
import { PlatformHealthView } from "@/features/platform/components/platform-health-view";
import { PlatformStaffView } from "@/features/platform/components/platform-staff-view";
import { PlatformPaymentDetailView } from "@/features/platform/components/platform-payment-detail-view";
import { PlatformReleaseDetailView } from "@/features/platform/components/platform-release-detail-view";
import { PlatformInsightDetailView } from "@/features/platform/components/platform-insight-detail-view";
import { PlatformClientErrorDetailView } from "@/features/platform/components/platform-client-error-detail-view";
import type { PlatformInsightMetric } from "@/convex/platformAnalytics";
import { OfflineUnavailable } from "@/components/offline/offline-unavailable";
import { LoadingState } from "@/components/feedback/loading-state";
import { Id } from "@/convex/_generated/dataModel";

const SHELL_VIEWS: Record<string, () => ReactNode> = {
  "/dashboard": () => <DashboardView />,
  "/sales": () => <SalesView />,
  "/orders": () => <OrdersView />,
  "/returns": () => <ReturnsView />,
  "/inventory": () => <InventoryView />,
  "/products": () => <ProductsView />,
  "/customers": () => <CustomersView />,
  "/reports": () => <ReportsView />,
  "/settings": () => (
    <Suspense fallback={null}>
      <SettingsView />
    </Suspense>
  ),
  "/customer-display": () => <CustomerDisplayView />,
  "/more": () => <MoreView />,
  "/about": () => <AboutNovendView />,
  "/users": () => <UsersView />,
  "/analytics": () => <AnalyticsView />,
  "/branches": () => <BranchesView />,
  "/wholesale": () => <WholesaleView />,
  "/suppliers": () => <SuppliersView />,
  "/floor": () => <DiningFloorView />,
  "/kitchen": () => <KitchenView />,
  "/rooms": () => <RoomsBoardView />,
  "/reservations": () => <ReservationsView />,
  "/platform": () => <PlatformOverviewView />,
  "/platform/analytics": () => <PlatformMonitoringView />,
  "/platform/activity": () => <PlatformActivityView />,
  "/platform/exports": () => <PlatformExportsView />,
  "/platform/help": () => <PlatformHelpView />,
  "/platform/organizations": () => <PlatformView />,
  "/platform/releases": () => <PlatformReleasesView />,
  "/platform/revenue": () => <PlatformRevenueView />,
  "/platform/costs": () => <PlatformCostsView />,
  "/platform/subscriptions": () => <PlatformSubscriptionsView />,
  "/platform/health": () => <PlatformHealthView />,
  "/platform/staff": () => <PlatformStaffView />,
};

/** Resolve a client-side feature view for offline shell navigation. */
export function resolveOfflineView(path: string): ReactNode {
  const exact = SHELL_VIEWS[path];
  if (exact) return exact();

  if (path.startsWith("/products/")) {
    const productId = path.slice("/products/".length);
    if (productId) {
      return <ProductDetailView productId={productId as Id<"products">} />;
    }
  }
  if (path.startsWith("/orders/")) {
    const orderId = path.slice("/orders/".length);
    if (orderId) {
      return <OrderDetailView orderId={orderId} />;
    }
    return (
      <OfflineUnavailable
        title="Order details unavailable offline"
        description="Completed offline sales stay on this device until sync. Reconnect to open full order details."
        backHref="/orders"
        backLabel="Back to orders"
      />
    );
  }
  if (path.startsWith("/customers/")) {
    const customerId = path.slice("/customers/".length);
    if (customerId) {
      return <CustomerDetailView customerId={customerId as Id<"customers">} />;
    }
  }
  if (path.startsWith("/returns/")) {
    const returnId = path.slice("/returns/".length);
    if (returnId) {
      return <ReturnDetailView returnId={returnId} />;
    }
  }
  if (path.startsWith("/branches/")) {
    const branchId = path.slice("/branches/".length);
    if (branchId) {
      return <BranchDetailView branchId={branchId} />;
    }
  }
  if (path.startsWith("/reports/day")) {
    return <ReportDayDetailView />;
  }
  if (path.startsWith("/reports/")) {
    const metric = path.slice("/reports/".length).split("/")[0];
    if (metric && metric !== "day") {
      return (
        <Suspense fallback={<LoadingState label="Loading…" variant="table" />}>
          <ReportMetricDetailView metric={metric} />
        </Suspense>
      );
    }
  }
  if (path.startsWith("/analytics/")) {
    const metric = path.slice("/analytics/".length).split("/")[0];
    if (metric) {
      return (
        <Suspense fallback={<LoadingState label="Loading…" variant="table" />}>
          <AnalyticsMetricDetailView metric={metric} />
        </Suspense>
      );
    }
  }
  if (path.startsWith("/users/")) {
    const userId = path.slice("/users/".length);
    if (userId) {
      return <UserDetailView profileId={userId as Id<"profiles">} />;
    }
    return <UsersView />;
  }
  if (path.startsWith("/platform/insights/")) {
    const rest = path.slice("/platform/insights/".length);
    if (rest.startsWith("client-errors/")) {
      const code = rest.slice("client-errors/".length);
      if (code && !code.includes("/")) {
        return <PlatformClientErrorDetailView code={decodeURIComponent(code)} />;
      }
    }
    if (rest && !rest.includes("/")) {
      return <PlatformInsightDetailView metric={rest as PlatformInsightMetric} />;
    }
  }
  if (path.startsWith("/platform/payments/")) {
    const paymentId = path.slice("/platform/payments/".length);
    if (paymentId && !paymentId.includes("/")) {
      return <PlatformPaymentDetailView paymentId={paymentId} />;
    }
  }
  if (path.startsWith("/platform/releases/")) {
    const version = decodeURIComponent(path.slice("/platform/releases/".length));
    if (version && !version.includes("/")) {
      return <PlatformReleaseDetailView version={version} />;
    }
  }
  if (path.startsWith("/platform/")) {
    const rest = path.slice("/platform/".length);
    if (
      rest &&
      !rest.includes("/") &&
      ![
        "organizations",
        "releases",
        "revenue",
        "costs",
        "subscriptions",
        "health",
        "payments",
      ].includes(rest)
    ) {
      return <PlatformOrgDetailView organizationId={rest} />;
    }
  }

  return (
    <OfflineUnavailable
      title="Page unavailable offline"
      description="Reconnect to open this screen."
    />
  );
}
