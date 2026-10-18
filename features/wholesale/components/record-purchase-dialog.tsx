"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnsignedQuantityInput } from "@/components/ui/unsigned-quantity-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ProductBarcodePicker } from "@/components/hardware/product-barcode-picker";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueUpsertSupplier,
  queueWholesalePurchase,
} from "@/lib/offline/replica-writes";
import { formatCurrency } from "@/lib/currency";
import { SETTLEMENT_METHOD_OPTIONS, type SettlementMethod } from "@/lib/payments";
import {
  resolveDeliveryAmountPaid,
  type SupplierSettlement,
} from "@/convex/shared/supplierFinance";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ProductFormDialog } from "@/features/products/components/product-form-dialog";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { SINGLE_STORE } from "@/constants/app";

type SupplierOption = { id: string; name: string };

export type PurchaseProductOption = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  tracksExpiry?: boolean;
  sellUnits?: Array<{ key: string; barcode?: string | null; active?: boolean }> | null;
};

type DraftLine = {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
  expiryDate: string;
};

function currentTime() {
  return Date.now();
}

function blankLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    productId: "",
    quantity: "1",
    unitCost: "",
    sellingPrice: "",
    expiryDate: "",
  };
}

export function RecordPurchaseDialog({
  open,
  onOpenChange,
  suppliers,
  products,
  defaultSupplierId,
  lockSupplier = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
  products: PurchaseProductOption[];
  defaultSupplierId?: string;
  lockSupplier?: boolean;
}) {
  const online = useConnectivity();
  const recordPurchase = useMutation(api.wholesale.recordPurchase);
  const createSupplier = useMutation(api.suppliers.create);
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "");
  const [newSupplier, setNewSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [settlement, setSettlement] = useState<SupplierSettlement>("paid");
  const [partialAmount, setPartialAmount] = useState("");
  const [method, setMethod] = useState<SettlementMethod>("cash");
  const [pending, setPending] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [applyToShelf, setApplyToShelf] = useState(FULLY_OFFLINE || SINGLE_STORE);

  const scanLineIndex = (() => {
    const empty = lines.findIndex((line) => !line.productId);
    return empty >= 0 ? empty : lines.length - 1;
  })();

  const total = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity);
    const cost = Number(line.unitCost);
    if (!Number.isFinite(quantity) || !Number.isFinite(cost)) return sum;
    return sum + quantity * cost;
  }, 0);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.productId) {
          const product = products.find((row) => row.id === patch.productId);
          if (product) {
            next.unitCost = String(product.costPrice ?? "");
            next.sellingPrice = String(product.sellingPrice ?? "");
          }
        }
        return next;
      }),
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      let sid = supplierId;
      if (!sid && !lockSupplier && newSupplier.trim()) {
        await persistBusinessWrite({
          online,
          remote: async () => {
            sid = await createSupplier({ name: newSupplier.trim() });
          },
          local: async () => {
            sid = await queueUpsertSupplier({ name: newSupplier.trim() });
          },
        });
      }
      if (!sid) throw new Error("Select or create a supplier");
      const items = lines.map((line) => {
        const product = products.find((row) => row.id === line.productId);
        if (!line.productId || !product) throw new Error("Select a product on every line");
        const quantity = Number(line.quantity);
        const cost = Number(line.unitCost);
        const sell = Number(line.sellingPrice);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error("Quantity must be a positive whole number");
        }
        if (!Number.isFinite(cost) || cost < 0) throw new Error("Enter a valid cost price");
        if (!Number.isFinite(sell) || sell < 0) throw new Error("Enter a valid selling price");
        if (product.tracksExpiry && !line.expiryDate) {
          throw new Error(`${product.name} requires an expiry date`);
        }
        return {
          productId: line.productId as Id<"products">,
          quantity,
          unitCost: cost,
          sellingPrice: sell,
          expiryDate: line.expiryDate || undefined,
        };
      });
      const amountPaid = resolveDeliveryAmountPaid(
        total,
        settlement,
        settlement === "partial" ? Number(partialAmount) : undefined,
      );
      const purchasedAt = currentTime();
      const purchaseArgs = {
        supplierId: sid as Id<"suppliers">,
        invoiceNumber: invoiceNumber || undefined,
        purchasedAt,
        amountPaid,
        paymentMethod: amountPaid > 0 ? method : undefined,
        items,
      };
      const kind = await persistBusinessWrite({
        online,
        remote: () => recordPurchase(purchaseArgs),
        local: () =>
          queueWholesalePurchase({
            supplierId: sid,
            invoiceNumber: purchaseArgs.invoiceNumber,
            purchasedAt,
            notes: undefined,
            amountPaid,
            paymentMethod: purchaseArgs.paymentMethod,
            applyToShelf,
            items,
          }),
      });
      toast.success(
        queuedSaveMessage(
          kind,
          applyToShelf ? "Delivery recorded and shelf stock updated" : "Delivery recorded",
        ),
      );
      onOpenChange(false);
    } catch (error) {
      showError(error, "Could not record delivery");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <form onSubmit={(event) => void onSubmit(event)}>
            <DialogHeader>
              <DialogTitle>Record a delivery</DialogTitle>
              <DialogDescription>
                One delivery can include several products. Record what you paid the supplier now.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {lockSupplier ? null : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <SearchableSelect
                      options={suppliers.map((row) => ({ value: row.id, label: row.name }))}
                      value={supplierId}
                      onValueChange={setSupplierId}
                      placeholder="Select supplier"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Or new supplier</Label>
                    <Input
                      value={newSupplier}
                      onChange={(event) => setNewSupplier(event.target.value)}
                      placeholder="Company name"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Invoice / reference</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                />
              </div>
              <div className="space-y-3">
                {lines.map((line, index) => {
                  const product = products.find((row) => row.id === line.productId);
                  return (
                    <div key={line.key} className="border-border space-y-3 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Product {index + 1}</p>
                        {lines.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setLines((current) => current.filter((row) => row.key !== line.key))
                            }
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <ProductBarcodePicker
                        products={products}
                        value={line.productId}
                        onValueChange={(value) => updateLine(line.key, { productId: value })}
                        enabled={open && index === scanLineIndex}
                        label="Product"
                        placeholder="Select or scan product"
                        scanPlaceholder="Scan barcode to pick this product…"
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <UnsignedQuantityInput
                            value={line.quantity}
                            onValueChange={(value) => updateLine(line.key, { quantity: value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cost price</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unitCost}
                            onChange={(event) =>
                              updateLine(line.key, { unitCost: event.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Selling price</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.sellingPrice}
                            onChange={(event) =>
                              updateLine(line.key, { sellingPrice: event.target.value })
                            }
                            required
                          />
                        </div>
                      </div>
                      {product?.tracksExpiry ? (
                        <div className="space-y-2">
                          <Label>Expiry</Label>
                          <Input
                            type="date"
                            value={line.expiryDate}
                            onChange={(event) =>
                              updateLine(line.key, { expiryDate: event.target.value })
                            }
                            required
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLines((current) => [...current, blankLine()])}
                  >
                    Add product
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setProductFormOpen(true)}>
                    New product
                  </Button>
                </div>
              </div>
              <label className="border-border flex items-start gap-3 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={applyToShelf}
                  onChange={(event) => setApplyToShelf(event.target.checked)}
                />
                <span>
                  <span className="font-medium">Update shelf stock automatically</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    Adds quantities to on-hand inventory and refreshes cost / sell prices from this
                    delivery.
                  </span>
                </span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Supplier payment</Label>
                  <select
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                    value={settlement}
                    onChange={(event) => setSettlement(event.target.value as SupplierSettlement)}
                  >
                    <option value="paid">Paid in full</option>
                    <option value="partial">Part paid</option>
                    <option value="owed">On credit — still owed</option>
                  </select>
                </div>
                {settlement === "partial" ? (
                  <div className="space-y-2">
                    <Label>Paid now</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={partialAmount}
                      onChange={(event) => setPartialAmount(event.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Delivery total</Label>
                    <p className="flex h-10 items-center text-sm font-medium">
                      {formatCurrency(total)}
                    </p>
                  </div>
                )}
              </div>
              {settlement !== "owed" ? (
                <div className="space-y-2">
                  <Label>Paid with</Label>
                  <select
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as SettlementMethod)}
                  >
                    {SETTLEMENT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nothing is paid now. The full {formatCurrency(total)} stays owed to this supplier.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Save delivery
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ProductFormDialog
        open={productFormOpen}
        onOpenChange={setProductFormOpen}
        productId={null}
        warehouseIntake
        onCreated={(created) => {
          setLines((current) => {
            const index = current.findIndex((line) => !line.productId);
            const target = index === -1 ? 0 : index;
            return current.map((line, lineIndex) =>
              lineIndex === target
                ? {
                    ...line,
                    productId: created.id,
                    unitCost: String(created.costPrice),
                    sellingPrice: String(created.sellingPrice),
                  }
                : line,
            );
          });
        }}
      />
    </>
  );
}
