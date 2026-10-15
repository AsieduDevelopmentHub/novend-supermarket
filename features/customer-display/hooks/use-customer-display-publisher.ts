"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  buildCustomerDisplaySnapshot,
  idleCustomerDisplaySnapshot,
  publishCustomerDisplaySnapshot,
  readCustomerDisplaySnapshot,
  type CustomerDisplayBranding,
  type CustomerDisplaySnapshot,
} from "@/lib/sales/customer-display";
import type { ReceiptPayload } from "@/features/receipts/types";

type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
};

type PublisherInput = {
  cart: CartItem[];
  catalogImages: Record<string, string | null | undefined>;
  discountMode: "amount" | "percent";
  discountField: number;
  subtotal: number;
  cartDiscount: number;
  total: number;
  customerName: string | null;
  paying: boolean;
  holding: boolean;
  branding: CustomerDisplayBranding;
  enabled: boolean;
};

/** Push cart snapshots from the cashier screen to customer display windows. */
function readPersistedComplete(): CustomerDisplaySnapshot | null {
  if (typeof window === "undefined") return null;
  const existing = readCustomerDisplaySnapshot();
  return existing?.phase === "complete" ? existing : null;
}

export function useCustomerDisplayPublisher(input: PublisherInput) {
  // Survive remounts: restore a complete receipt that is still in localStorage.
  const completeSnapshotRef = useRef<CustomerDisplaySnapshot | null>(readPersistedComplete());

  const liveSnapshot = useMemo(() => {
    if (input.paying || input.holding) {
      return buildCustomerDisplaySnapshot({
        phase: "processing",
        items: input.cart,
        imageByProductId: input.catalogImages,
        discountMode: input.discountMode,
        discountField: input.discountField,
        subtotal: input.subtotal,
        cartDiscount: input.cartDiscount,
        total: input.total,
        customerName: input.customerName,
        branding: input.branding,
      });
    }
    if (input.cart.length > 0) {
      return buildCustomerDisplaySnapshot({
        phase: "active",
        items: input.cart,
        imageByProductId: input.catalogImages,
        discountMode: input.discountMode,
        discountField: input.discountField,
        subtotal: input.subtotal,
        cartDiscount: input.cartDiscount,
        total: input.total,
        customerName: input.customerName,
        branding: input.branding,
      });
    }
    return idleCustomerDisplaySnapshot(input.branding);
  }, [
    input.branding,
    input.cart,
    input.catalogImages,
    input.cartDiscount,
    input.customerName,
    input.discountField,
    input.discountMode,
    input.holding,
    input.paying,
    input.subtotal,
    input.total,
  ]);

  useEffect(() => {
    if (input.cart.length > 0 && completeSnapshotRef.current) {
      completeSnapshotRef.current = null;
      // Publish the live cart immediately so the previous receipt cannot linger a frame.
      if (input.enabled) {
        publishCustomerDisplaySnapshot(liveSnapshot);
      }
    }
  }, [input.cart.length, input.enabled, liveSnapshot]);

  useEffect(() => {
    if (!input.enabled) return;
    // Keep the thank-you receipt until the cashier starts the next cart.
    if (completeSnapshotRef.current) return;
    publishCustomerDisplaySnapshot(liveSnapshot);
  }, [input.enabled, liveSnapshot]);

  const publishComplete = useCallback(
    (receipt: ReceiptPayload) => {
      if (!input.enabled) return;

      const snapshot = buildCustomerDisplaySnapshot({
        phase: "complete",
        items: receipt.lines.map((line, index) => ({
          productId: `line-${index}`,
          name: line.productName,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          discount: line.discount,
        })),
        discountMode: "amount",
        discountField: receipt.discount,
        subtotal: receipt.subtotal,
        cartDiscount: receipt.discount,
        total: receipt.total,
        customerName: receipt.customerName,
        paymentMethod: receipt.paymentMethod,
        invoiceNumber: receipt.invoiceNumber,
        completedAt: receipt.completedAt,
        branding: input.branding,
      });

      completeSnapshotRef.current = snapshot;
      publishCustomerDisplaySnapshot(snapshot);
    },
    [input.branding, input.enabled],
  );

  return { publishComplete };
}
