"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  buildCustomerDisplaySnapshot,
  idleCustomerDisplaySnapshot,
  publishCustomerDisplaySnapshot,
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

const COMPLETE_RESET_MS = 12_000;

/** Push cart snapshots from the cashier screen to customer display windows. */
export function useCustomerDisplayPublisher(input: PublisherInput) {
  const completeSnapshotRef = useRef<CustomerDisplaySnapshot | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    }
  }, [input.cart.length]);

  useEffect(() => {
    if (!input.enabled) return;
    if (completeSnapshotRef.current) return;
    publishCustomerDisplaySnapshot(liveSnapshot);
  }, [input.enabled, liveSnapshot]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

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

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        completeSnapshotRef.current = null;
        resetTimerRef.current = null;
        publishCustomerDisplaySnapshot(idleCustomerDisplaySnapshot(input.branding));
      }, COMPLETE_RESET_MS);
    },
    [input.branding, input.enabled],
  );

  return { publishComplete };
}
