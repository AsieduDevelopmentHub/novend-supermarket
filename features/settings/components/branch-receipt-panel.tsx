"use client";

import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useRemoteBudget } from "@/hooks/use-remote-budget";
import { BranchReceiptForm } from "./branch-receipt-form";

export function BranchReceiptPanel() {
  const online = useConnectivity();
  const branch = useAuthedQuery(api.branches.getMineForReceipt, online ? {} : "skip");
  const remoteBudgetElapsed = useRemoteBudget(online && branch === undefined);

  if (!online || (branch === undefined && remoteBudgetElapsed)) {
    return (
      <EmptyState
        title="Branch receipt settings need a connection"
        description="You can still print using the last cached receipt layout. Reconnect to edit branch contact details."
      />
    );
  }

  if (branch === undefined) {
    return <LoadingState label="Loading branch receipt…" variant="form" />;
  }

  if (!branch) {
    return (
      <EmptyState
        title="No branch assigned"
        description="Ask an administrator to assign you to a branch before editing receipt details."
      />
    );
  }

  return (
    <BranchReceiptForm
      key={branch.id}
      branch={{
        id: branch.id,
        name: branch.name,
        address: branch.address ?? null,
        phone: branch.phone ?? null,
        email: branch.email ?? null,
        receiptShowName: branch.receiptShowName ?? true,
        receiptShowAddress: branch.receiptShowAddress ?? true,
        receiptShowPhone: branch.receiptShowPhone ?? true,
        receiptShowEmail: branch.receiptShowEmail ?? true,
        receiptPaperWidthMm:
          branch.receiptPaperWidthMm === 58 || branch.receiptPaperWidthMm === 80
            ? branch.receiptPaperWidthMm
            : null,
      }}
    />
  );
}
