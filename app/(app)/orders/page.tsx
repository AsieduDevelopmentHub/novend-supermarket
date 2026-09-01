import { Suspense } from "react";
import { OrdersView } from "@/features/orders/components/orders-view";

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}
