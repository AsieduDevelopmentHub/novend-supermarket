"use client";

import type { ReactNode } from "react";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { SalesView } from "@/features/sales/components/sales-view";
import { OrdersView } from "@/features/orders/components/orders-view";
import { OrderDetailView } from "@/features/orders/components/order-detail-view";
import { InventoryView } from "@/features/inventory/components/inventory-view";
import { ProductsView } from "@/features/products/components/products-view";
import { CustomersView } from "@/features/customers/components/customers-view";
import { ReportsView } from "@/features/reports/components/reports-view";
import { ReportDayDetailView } from "@/features/reports/components/day-detail-view";
import { SettingsView } from "@/features/settings/components/settings-view";
import { UsersView } from "@/features/users/components/users-view";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { BranchesView } from "@/features/branches/components/branches-view";
import { ReturnsView } from "@/features/returns/components/returns-view";
import { ReturnDetailView } from "@/features/returns/components/return-detail-view";
import { BranchDetailView } from "@/features/branches/components/branch-detail-view";
import { WholesaleView } from "@/features/wholesale/components/wholesale-view";
import { SuppliersView } from "@/features/suppliers/components/suppliers-view";
import { OfflineUnavailable } from "@/components/offline/offline-unavailable";

const SHELL_VIEWS: Record<string, () => ReactNode> = {
  "/dashboard": () => <DashboardView />,
  "/sales": () => <SalesView />,
  "/orders": () => <OrdersView />,
  "/returns": () => <ReturnsView />,
  "/inventory": () => <InventoryView />,
  "/products": () => <ProductsView />,
  "/customers": () => <CustomersView />,
  "/reports": () => <ReportsView />,
  "/settings": () => <SettingsView />,
  "/users": () => <UsersView />,
  "/analytics": () => <AnalyticsView />,
  "/branches": () => <BranchesView />,
  "/wholesale": () => <WholesaleView />,
  "/suppliers": () => <SuppliersView />,
};

/** Resolve a client-side feature view for offline shell navigation. */
export function resolveOfflineView(path: string): ReactNode {
  const exact = SHELL_VIEWS[path];
  if (exact) return exact();

  if (path.startsWith("/products/")) {
    return (
      <OfflineUnavailable
        title="Product details unavailable offline"
        backHref="/products"
        backLabel="Back to products"
      />
    );
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
    return (
      <OfflineUnavailable
        title="Customer details unavailable offline"
        backHref="/customers"
        backLabel="Back to customers"
      />
    );
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
  if (path.startsWith("/users/")) {
    return <UsersView />;
  }

  return (
    <OfflineUnavailable
      title="Page unavailable offline"
      description="Reconnect to open this screen."
    />
  );
}
