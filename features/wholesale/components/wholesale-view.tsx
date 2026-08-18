"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { OfflineAdminShell } from "@/components/offline/offline-admin-shell";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ArrowRightLeft, Plus, Warehouse } from "lucide-react";
import Link from "next/link";

export function WholesaleView() {
  const { canManageProducts, isAdmin, branchId } = usePermissions();
  const online = useConnectivity();
  const [search, setSearch] = useState("");
  const stock = useQuery(api.wholesale.listStock, online && canManageProducts ? { search } : "skip");
  const summary = useQuery(api.wholesale.summary, online && canManageProducts ? {} : "skip");
  const purchases = useQuery(
    api.wholesale.listPurchases,
    online && canManageProducts ? {} : "skip",
  );
  const transfers = useQuery(
    api.wholesale.listTransfers,
    online && canManageProducts ? {} : "skip",
  );
  const suppliers = useQuery(api.suppliers.list, online && canManageProducts ? {} : "skip");
  const products = useQuery(
    api.products.listProducts,
    online && canManageProducts ? {} : "skip",
  );
  const branches = useQuery(api.branches.list, online && canManageProducts ? {} : "skip");
  const recordPurchase = useMutation(api.wholesale.recordPurchase);
  const transferToBranch = useMutation(api.wholesale.transferToBranch);
  const createSupplier = useMutation(api.suppliers.create);

  const [buyOpen, setBuyOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [newSupplier, setNewSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
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

  if (!online) {
    return (
      <OfflineAdminShell
        title="Wholesale"
        description="Supplier purchases and warehouse stock require a live connection."
      />
    );
  }

  async function onPurchase(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      let sid = supplierId as Id<"suppliers">;
      if (!sid && newSupplier.trim()) {
        sid = await createSupplier({ name: newSupplier.trim() });
      }
      if (!sid) throw new Error("Select or create a supplier");
      if (!productId) throw new Error("Select a product");
      await recordPurchase({
        supplierId: sid,
        invoiceNumber: invoiceNumber || undefined,
        purchasedAt: Date.now(),
        items: [
          {
            productId: productId as Id<"products">,
            quantity: Number(quantity),
            unitCost: Number(unitCost),
            expiryDate: expiryDate || undefined,
          },
        ],
      });
      toast.success("Purchase recorded in wholesale");
      setBuyOpen(false);
      setQuantity("1");
      setUnitCost("");
      setInvoiceNumber("");
      setExpiryDate("");
    } catch (error) {
      showError(error, "Could not record purchase");
    } finally {
      setPending(false);
    }
  }

  async function onIssue(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const dest = (issueBranchId || branchId || "") as Id<"branches">;
      if (!issueProductId || !dest) throw new Error("Choose a product and branch");
      await transferToBranch({
        productId: issueProductId as Id<"products">,
        branchId: dest,
        quantity: Number(issueQty),
      });
      toast.success("Stock issued to branch");
      setIssueOpen(false);
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
        description="Stock bought from suppliers sits here until it is issued to a branch."
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

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search warehouse stock…"
        className="max-w-md"
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {stock === undefined ? (
            <div className="p-6">
              <LoadingState label="Loading wholesale stock…" />
            </div>
          ) : stock.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Warehouse}
                title="Warehouse is empty"
                description="Record a supplier purchase to add backup stock."
              />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
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
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>
                      {row.reference} · {row.supplierName}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(row.totalCost)} · {formatDateTime(row.purchasedAt)}
                    </span>
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

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <form onSubmit={(e) => void onPurchase(e)}>
            <DialogHeader>
              <DialogTitle>Record supplier purchase</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <SearchableSelect
                  options={(suppliers ?? []).map((s) => ({ value: s._id, label: s.name }))}
                  value={supplierId}
                  onValueChange={setSupplierId}
                  placeholder="Select supplier"
                />
                <Input
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  placeholder="Or type a new supplier name"
                />
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <SearchableSelect
                  options={(products ?? []).map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  value={productId}
                  onValueChange={setProductId}
                  placeholder="Select product"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit cost</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Invoice / reference</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expiry (dated products)</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Save purchase
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                    .map((row) => ({ value: row.productId, label: `${row.name} (${row.quantity})` }))}
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
                <Input
                  type="number"
                  min={1}
                  value={issueQty}
                  onChange={(e) => setIssueQty(e.target.value)}
                  required
                />
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
