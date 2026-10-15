"use client";

import { useEffect, useState } from "react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useRemoteBudget } from "@/hooks/use-remote-budget";
import { loadMilliesBranchReceipt } from "@/lib/offline/millies-print-settings";
import { BranchReceiptForm } from "./branch-receipt-form";

export function BranchReceiptPanel() {
  const online = useConnectivity();
  const branch = useAuthedQuery(
    api.branches.getMineForReceipt,
    !FULLY_OFFLINE && online ? {} : "skip",
  );
  const remoteBudgetElapsed = useRemoteBudget(!FULLY_OFFLINE && online && branch === undefined);
  const [localBranch, setLocalBranch] = useState<Awaited<
    ReturnType<typeof loadMilliesBranchReceipt>
  > | null>(null);
  const [localReady, setLocalReady] = useState(!FULLY_OFFLINE);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!FULLY_OFFLINE) return;
    let cancelled = false;
    void loadMilliesBranchReceipt().then((row) => {
      if (cancelled) return;
      setLocalBranch(row);
      setLocalReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  if (FULLY_OFFLINE) {
    if (!localReady) {
      return <LoadingState label="Loading store receipt…" variant="form" />;
    }
    if (!localBranch) {
      return (
        <EmptyState
          title="Store receipt unavailable"
          description="Local storage could not be opened on this till. Restart the app and try again."
        />
      );
    }
    return (
      <BranchReceiptForm
        key={`${revision}:${localBranch.id}`}
        branch={{
          id: localBranch.id as never,
          name: localBranch.name,
          address: localBranch.address,
          phone: localBranch.phone,
          email: localBranch.email,
          receiptShowName: localBranch.receiptShowName,
          receiptShowAddress: localBranch.receiptShowAddress,
          receiptShowPhone: localBranch.receiptShowPhone,
          receiptShowEmail: localBranch.receiptShowEmail,
          receiptPaperWidthMm: localBranch.receiptPaperWidthMm,
        }}
        onLocalSaved={() => setRevision((n) => n + 1)}
      />
    );
  }

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
