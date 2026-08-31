"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { formatCurrency } from "@/lib/currency";
import { StockStatusBadges } from "@/features/inventory/components/stock-status-badges";
import { formatExpiryDate, lotStatus, DEFAULT_EXPIRY_ALERT_DAYS } from "@/lib/expiry";
import { showError } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { getMirroredProduct, listMirroredLots } from "@/lib/offline/mirror-queries";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueAdjustStock,
  queueUpdateLotExpiry,
} from "@/lib/offline/replica-writes";
import { ArrowLeft, Package, Pencil, PackagePlus, Trash2, Warehouse } from "lucide-react";
import { ProductImage } from "@/components/media/product-image";
import { toast } from "sonner";
import { ProductFormDialog } from "./product-form-dialog";

export function ProductDetailView({ productId }: { productId: Id<"products"> }) {
  const { canManageProducts, canViewCost, isAdmin, branchId: myBranchId } = usePermissions();
  const online = useConnectivity();
  const branchScope = isAdmin ? undefined : (myBranchId ?? undefined);
  const remote = useQuery(
    api.products.getProduct,
    online && !String(productId).startsWith("local_")
      ? { id: productId, branchId: branchScope }
      : "skip",
  );
  const remoteLots = useQuery(
    api.inventory.listLots,
    online && !String(productId).startsWith("local_") ? { productId } : "skip",
  );
  const [local, setLocal] = useState<Awaited<ReturnType<typeof getMirroredProduct>> | undefined>(
    undefined,
  );
  const [localLots, setLocalLots] = useState<
    Awaited<ReturnType<typeof listMirroredLots>> | undefined
  >(undefined);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void getMirroredProduct(productId, branchScope ?? null).then((row) => {
        if (!cancelled) setLocal(row);
      });
      void listMirroredLots(productId, isAdmin ? null : (myBranchId ?? null)).then((rows) => {
        if (!cancelled) setLocalLots(rows);
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [productId, branchScope, isAdmin, myBranchId]);
  const archiveProduct = useMutation(api.products.archiveProduct);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const writeOffExpired = useMutation(api.inventory.writeOffExpired);
  const updateLotExpiry = useMutation(api.inventory.updateLotExpiry);

  const [editOpen, setEditOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [quantityChange, setQuantityChange] = useState("0");
  const [reason, setReason] = useState<"receive" | "adjustment" | "damage" | "return">("receive");
  const [note, setNote] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [writeOffPending, setWriteOffPending] = useState(false);
  const [lotDrafts, setLotDrafts] = useState<Record<string, string>>({});
  const [savingLotId, setSavingLotId] = useState<string | null>(null);

  const product =
    remote ??
    (local
      ? {
          _id: productId,
          id: productId,
          name: local.name,
          sku: local.sku,
          barcode: local.barcode,
          categoryName: local.categoryName,
          sellingPrice: local.sellingPrice,
          costPrice: local.costPrice,
          stockQuantity: local.stockQuantity,
          sellableQuantity: local.sellableQuantity ?? local.stockQuantity,
          unit: local.unit,
          lowStockThreshold: local.lowStockThreshold,
          status: local.status,
          imageUrl: local.imageUrl,
          tracksExpiry: local.tracksExpiry,
          nearestExpiry: local.nearestExpiry,
          isExpired: local.isExpired,
          isExpiring: local.isExpiring,
          isLowStock: local.stockQuantity <= local.lowStockThreshold,
          description: null,
          expiredQuantity: 0,
        }
      : remote === undefined && local === undefined
        ? undefined
        : null);

  if (product === undefined) {
    return <LoadingState label="Loading product…" />;
  }

  if (!product) {
    return <ErrorState message="Product not found." />;
  }

  const isLow = product.isLowStock ?? product.stockQuantity <= product.lowStockThreshold;
  const isArchived = product.status === "archived";
  const tracksExpiry = product.tracksExpiry === true;
  const productUnit = product.unit;
  const alertDays = local?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS;
  const mappedLocalLots =
    localLots === undefined
      ? undefined
      : localLots.map((lot) => ({
          id: lot.id as Id<"inventoryLots">,
          branchId: lot.branchId as Id<"branches">,
          branchName: lot.branchName ?? null,
          quantity: lot.quantity,
          expiryDate: lot.expiryDate,
          lotCode: lot.lotCode,
          receivedAt: lot.receivedAt,
          status: lotStatus(lot.expiryDate, alertDays),
        }));
  const lots =
    mappedLocalLots && mappedLocalLots.length > 0
      ? mappedLocalLots
      : (remoteLots ?? mappedLocalLots);

  async function onSaveLotExpiry(lotId: string, current: string) {
    const next = (lotDrafts[lotId] ?? current).trim();
    if (!next || next === current) return;
    setSavingLotId(lotId);
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          updateLotExpiry({
            lotId: lotId as Id<"inventoryLots">,
            expiryDate: next,
          }),
        local: () =>
          queueUpdateLotExpiry({
            lotId,
            productId,
            expiryDate: next,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Lot expiry updated"));
      setLotDrafts((prev) => {
        const rest = { ...prev };
        delete rest[lotId];
        return rest;
      });
    } catch (error) {
      showError(error, "Could not update expiry");
    } finally {
      setSavingLotId(null);
    }
  }

  async function onRestock(event: FormEvent) {
    event.preventDefault();
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          adjustStock({
            productId,
            quantityChange: Number(quantityChange),
            reason,
            note: note || undefined,
            expiryDate: expiryDate || undefined,
          }),
        local: () =>
          queueAdjustStock({
            productId,
            quantityChange: Number(quantityChange),
            reason,
            note: note || undefined,
            expiryDate: expiryDate || undefined,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Stock updated"));
      setRestockOpen(false);
      setQuantityChange("0");
      setNote("");
      setExpiryDate("");
      setReason("receive");
    } catch (error) {
      showError(error, "Could not update stock");
    }
  }

  async function onWriteOff(lotId?: Id<"inventoryLots">) {
    setWriteOffPending(true);
    try {
      const count = await writeOffExpired({
        productId,
        lotId,
      });
      toast.success(`Wrote off ${count} expired ${productUnit}`);
    } catch (error) {
      showError(error, "Could not write off expired stock");
    } finally {
      setWriteOffPending(false);
    }
  }

  async function confirmArchive() {
    setArchivePending(true);
    try {
      await archiveProduct({ id: productId });
      toast.success("Product archived");
      setArchiveOpen(false);
    } catch (error) {
      showError(error, "Archive failed");
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={product.barcode ? `${product.sku} · ${product.barcode}` : product.sku}
        compactActions={[
          { key: "back", label: "Products", icon: ArrowLeft, href: "/products" },
          { key: "inventory", label: "Inventory", icon: Warehouse, href: "/inventory" },
          ...(canManageProducts && !isArchived
            ? [
                {
                  key: "edit",
                  label: "Edit",
                  icon: Pencil,
                  onClick: () => setEditOpen(true),
                },
                {
                  key: "restock",
                  label: "Restock",
                  icon: PackagePlus,
                  onClick: () => {
                    setQuantityChange("0");
                    setReason("receive");
                    setNote("");
                    setExpiryDate("");
                    setRestockOpen(true);
                  },
                },
              ]
            : []),
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/products">
                <ArrowLeft className="h-4 w-4" />
                Products
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/inventory">Inventory</Link>
            </Button>
            {canManageProducts && !isArchived ? (
              <>
                <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuantityChange("0");
                    setReason("receive");
                    setNote("");
                    setExpiryDate("");
                    setRestockOpen(true);
                  }}
                >
                  <PackagePlus className="h-4 w-4" />
                  Restock
                </Button>
                <Button type="button" variant="outline" onClick={() => setArchiveOpen(true)}>
                  <Trash2 className="text-destructive h-4 w-4" />
                  Archive
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="p-4">
            <div className="bg-muted relative aspect-square overflow-hidden rounded-xl">
              <ProductImage
                productId={product._id}
                remoteUrl={product.imageUrl}
                alt={product.name}
                sizes="280px"
                fallback={
                  <Package className="text-muted-foreground absolute inset-0 m-auto h-12 w-12" />
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Category" value={product.categoryName} />
            <Field label="Unit" value={product.unit} />
            <Field label="Selling price" value={formatCurrency(product.sellingPrice)} />
            {canViewCost ? (
              <Field
                label="Cost price"
                value={product.costPrice !== undefined ? formatCurrency(product.costPrice) : "—"}
              />
            ) : null}
            <Field label="Stock" value={`${product.stockQuantity} ${product.unit}`} />
            {tracksExpiry ? (
              <Field
                label="Sellable"
                value={`${product.sellableQuantity ?? product.stockQuantity} ${product.unit}`}
              />
            ) : null}
            <div>
              <p className="text-muted-foreground">Status</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {isArchived ? (
                  <Badge variant="secondary">Archived</Badge>
                ) : (
                  <StockStatusBadges
                    isLowStock={isLow}
                    isExpired={product.isExpired}
                    isExpiring={product.isExpiring}
                  />
                )}
              </div>
            </div>
            {product.description ? (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Description</p>
                <p className="mt-1">{product.description}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {tracksExpiry ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Expiry lots</CardTitle>
            {canManageProducts && (product.expiredQuantity ?? 0) > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={writeOffPending}
                onClick={() => void onWriteOff()}
              >
                Write off expired
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {lots === undefined ? (
              <LoadingState label="Loading lots…" />
            ) : lots.length === 0 ? (
              <p className="text-muted-foreground text-sm">No dated stock on hand.</p>
            ) : (
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Lot</th>
                      {lots.some((lot) => lot.branchName) ? (
                        <th className="pb-2 font-medium">Branch</th>
                      ) : null}
                      <th className="pb-2 font-medium">Qty</th>
                      <th className="pb-2 font-medium">Expiry</th>
                      <th className="pb-2 font-medium">Status</th>
                      {canManageProducts ? (
                        <th className="pb-2 font-medium">
                          <span className="sr-only">Action</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lot) => {
                      const draft = lotDrafts[lot.id] ?? lot.expiryDate;
                      const dirty = draft !== lot.expiryDate;
                      return (
                        <tr key={lot.id} className="border-border/70 border-b last:border-0">
                          <td className="py-2.5 font-medium">{lot.lotCode}</td>
                          {lots.some((row) => row.branchName) ? (
                            <td className="py-2.5">{lot.branchName ?? "—"}</td>
                          ) : null}
                          <td className="py-2.5">
                            {lot.quantity} {product.unit}
                          </td>
                          <td className="py-2.5">
                            {canManageProducts && !isArchived ? (
                              <Input
                                type="date"
                                className="h-9 w-full max-w-[11rem] min-w-0"
                                value={draft}
                                aria-label={`Expiry for lot ${lot.lotCode}`}
                                onChange={(e) =>
                                  setLotDrafts((prev) => ({ ...prev, [lot.id]: e.target.value }))
                                }
                              />
                            ) : (
                              formatExpiryDate(lot.expiryDate)
                            )}
                          </td>
                          <td className="py-2.5">
                            {lot.status === "expired" ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : lot.status === "expiring" ? (
                              <Badge variant="warning">Expiring</Badge>
                            ) : (
                              <Badge variant="success">OK</Badge>
                            )}
                          </td>
                          {canManageProducts ? (
                            <td className="py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {dirty ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={savingLotId === lot.id}
                                    onClick={() => void onSaveLotExpiry(lot.id, lot.expiryDate)}
                                  >
                                    {savingLotId === lot.id ? "Saving…" : "Save"}
                                  </Button>
                                ) : null}
                                {lot.status === "expired" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={writeOffPending}
                                    onClick={() => void onWriteOff(lot.id)}
                                  >
                                    Write off
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canManageProducts ? (
        <>
          <ProductFormDialog open={editOpen} onOpenChange={setEditOpen} productId={productId} />

          <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Restock / adjust stock</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onRestock}>
                <p className="text-muted-foreground text-sm">
                  Current stock: {product.stockQuantity} {product.unit}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="qty-change">Quantity change</Label>
                  <Input
                    id="qty-change"
                    type="number"
                    value={quantityChange}
                    onChange={(e) => setQuantityChange(e.target.value)}
                    required
                  />
                  <p className="text-muted-foreground text-xs">
                    Use a positive number to receive stock, negative to remove.
                  </p>
                </div>
                {tracksExpiry && Number(quantityChange) > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="restock-expiry">Expiry date</Label>
                    <Input
                      id="restock-expiry"
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      required
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Select
                    value={reason}
                    onValueChange={(v) =>
                      setReason(v as "receive" | "adjustment" | "damage" | "return")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receive">Receive</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                      <SelectItem value="damage">Damage</SelectItem>
                      <SelectItem value="return">Return</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock-note">Note (optional)</Label>
                  <Input id="stock-note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRestockOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Update stock</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={archiveOpen}
            onOpenChange={(open) => !open && setArchiveOpen(false)}
            title="Archive product?"
            description={`“${product.name}” will be archived and removed from the active catalog.`}
            confirmLabel="Archive"
            pending={archivePending}
            onConfirm={confirmArchive}
          />
        </>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
