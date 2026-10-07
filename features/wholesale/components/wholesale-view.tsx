"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { purchaseBalance } from "@/convex/shared/supplierFinance";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { UnsignedQuantityInput } from "@/components/ui/unsigned-quantity-input";
import { BarcodeSearchField } from "@/components/hardware/barcode-search-field";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { RecordPurchaseDialog } from "@/features/wholesale/components/record-purchase-dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  useBranchesList,
  useProductsList,
  useSuppliersList,
  useWholesaleLists,
} from "@/hooks/use-offline-lists";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueWholesaleTransfer,
} from "@/lib/offline/replica-writes";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ArrowRightLeft, Plus, Truck, Warehouse } from "lucide-react";
import Link from "next/link";

export function WholesaleView() {
  const { canManageProducts, isAdmin, branchId } = usePermissions();
  const online = useConnectivity();
  const [search, setSearch] = useState("");
  const { stock, summary, purchases, transfers } = useWholesaleLists(search);
  const { suppliers } = useSuppliersList({ search: "", includeInactive: false });
  const { products } = useProductsList({
    search: "",
    includeInactive: false,
    canViewCost: true,
    preferLocal: true,
  });
  const branches = useBranchesList(false);
  const transferToBranch = useMutation(api.wholesale.transferToBranch);

  const [buyOpen, setBuyOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueProductId, setIssueProductId] = useState<string>("");
  const [issueQty, setIssueQty] = useState("1");
  const [issueBranchId, setIssueBranchId] = useState<string>("");
  const [pending, setPending] = useState(false);

  if (!canManageProducts) {
    return (
      <EmptyState
        title="Access required"
        description="Wholesale inventory is limited to administrators and managers."
      />
    );
  }

  async function onIssue(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const dest = issueBranchId || branchId || "";
      if (!issueProductId || !dest) throw new Error("Choose a product and branch");
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          transferToBranch({
            productId: issueProductId as Id<"products">,
            branchId: dest as Id<"branches">,
            quantity: Number(issueQty),
          }),
        local: () =>
          queueWholesaleTransfer({
            productId: issueProductId,
            branchId: dest,
            quantity: Number(issueQty),
          }),
      });
      toast.success(queuedSaveMessage(kind, "Stock issued to branch"));
      setIssueOpen(false);
      setIssueProductId("");
      setIssueQty("1");
      setIssueBranchId("");
    } catch (error) {
      showError(error, "Transfer failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wholesale inventory"
        description="Buy from suppliers, set catalog cost and selling prices, then issue stock to branches."
        compactActions={[
          { key: "suppliers", label: "Suppliers", icon: Truck, href: "/suppliers" },
          {
            key: "issue",
            label: "Issue to branch",
            icon: ArrowRightLeft,
            onClick: () => setIssueOpen(true),
          },
          {
            key: "buy",
            label: "Record purchase",
            icon: Plus,
            onClick: () => setBuyOpen(true),
          },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/suppliers">Suppliers</Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => setIssueOpen(true)}>
              <ArrowRightLeft className="h-4 w-4" />
              Issue to branch
            </Button>
            <Button type="button" onClick={() => setBuyOpen(true)}>
              <Plus className="h-4 w-4" />
              Record purchase
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">SKUs in warehouse</p>
            <p className="mt-1 text-2xl font-semibold">{summary?.skuCount ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Units on hand</p>
            <p className="mt-1 text-2xl font-semibold">{summary?.units ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Warehouse value</p>
            <p className="mt-1 text-2xl font-semibold">
              {summary ? formatCurrency(summary.value) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <BarcodeSearchField
        value={search}
        onChange={setSearch}
        placeholder="Search warehouse stock or scan barcode…"
        listenHid={!buyOpen && !issueOpen}
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {stock == null ? (
            <div className="p-6">
              <LoadingState label="Loading wholesale stock…" />
            </div>
          ) : stock.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Warehouse}
                title="Warehouse is empty"
                description="Record a supplier purchase to add stock."
                action={
                  <Button type="button" onClick={() => setBuyOpen(true)}>
                    Record purchase
                  </Button>
                }
              />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Selling</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((row) => (
                  <tr key={row.id} className="border-border border-t">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.sku}</td>
                    <td className="px-4 py-3">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(row.costPrice)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.sellingPrice ?? 0)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 font-semibold">Recent purchases</h2>
            {purchases?.length ? (
              <ul className="space-y-2 text-sm">
                {purchases.slice(0, 8).map((row) => (
                  <li key={row.id} className="border-border space-y-1 border-b pb-2 last:border-0">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">
                        {row.reference} · {row.supplierName}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {formatCurrency(row.totalCost)}
                        {purchaseBalance(row) > 0 ? ` · owed ${formatCurrency(purchaseBalance(row))}` : ""}
                        {" · "}
                        {formatDateTime(row.purchasedAt)}
                      </span>
                    </div>
                    {row.items?.length ? (
                      <ul className="text-muted-foreground space-y-0.5 text-xs">
                        {row.items.map((item) => (
                          <li key={`${row.id}-${item.productId}-${item.quantity}-${item.unitCost}`}>
                            {item.productName} · {item.quantity} · cost{" "}
                            {formatCurrency(item.unitCost)}
                            {item.unitSellingPrice != null
                              ? ` · sell ${formatCurrency(item.unitSellingPrice)}`
                              : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-xs">{row.itemCount} units</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No purchases yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 font-semibold">Recent branch issues</h2>
            {transfers?.length ? (
              <ul className="space-y-2 text-sm">
                {transfers.slice(0, 8).map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>
                      {row.productName} → {row.branchName}
                    </span>
                    <span className="text-muted-foreground">
                      {row.quantity} · {formatDateTime(row.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No warehouse transfers yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <RecordPurchaseDialog
        key={buyOpen ? "purchase-open" : "purchase-closed"}
        open={buyOpen}
        onOpenChange={setBuyOpen}
        suppliers={suppliers ?? []}
        products={products ?? []}
      />

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <form onSubmit={(e) => void onIssue(e)}>
            <DialogHeader>
              <DialogTitle>Issue warehouse stock to a branch</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <SearchableSelect
                  options={(stock ?? [])
                    .filter((row) => row.quantity > 0)
                    .map((row) => ({
                      value: row.productId,
                      label: `${row.name} (${row.quantity})`,
                    }))}
                  value={issueProductId}
                  onValueChange={setIssueProductId}
                  placeholder="Select stock"
                />
              </div>
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <SearchableSelect
                    options={(branches ?? []).map((b) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                    value={issueBranchId}
                    onValueChange={setIssueBranchId}
                    placeholder="Destination branch"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Quantity</Label>
                <UnsignedQuantityInput value={issueQty} onValueChange={setIssueQty} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
