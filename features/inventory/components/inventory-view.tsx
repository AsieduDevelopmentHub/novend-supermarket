"use client";

import { FormEvent, useMemo, useState, Suspense } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { BranchFilter } from "@/components/filters/branch-filter";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useCategoriesList, useInventoryList } from "@/hooks/use-offline-lists";
import { StockStatusBadges } from "@/features/inventory/components/stock-status-badges";
import { formatExpiryDate } from "@/lib/expiry";
import { ArrowLeftRight, Boxes, Eye } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

function InventoryViewInner() {
  const {
    isAdmin,
    canManageProducts,
    canTransferStock,
    branchId: myBranchId,
    branchName,
  } = usePermissions();
  const online = useConnectivity();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");
  const lowOnly = filter === "low";
  const expiryOnly = filter === "expiry";
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  /** Admin override; default `all` = organization-wide stock totals. */
  const [branchOverride, setBranchOverride] = useState<Id<"branches"> | "all">("all");
  const [adjustId, setAdjustId] = useState<Id<"products"> | null>(null);
  const [adjustBranchId, setAdjustBranchId] = useState<Id<"branches"> | "">("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [quantityChange, setQuantityChange] = useState("0");
  const [reason, setReason] = useState<"receive" | "adjustment" | "damage" | "return">("adjustment");
  const [note, setNote] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [fromBranchId, setFromBranchId] = useState<Id<"branches"> | "">("");
  const [toBranchId, setToBranchId] = useState<Id<"branches"> | "">("");
  const [transferProductId, setTransferProductId] = useState<Id<"products"> | "">("");
  const [transferQty, setTransferQty] = useState("1");
  const [transferNote, setTransferNote] = useState("");

  const branches = useQuery(api.branches.list, isAdmin && online ? {} : "skip");
  const transferBranches = useQuery(
    api.branches.listTransferOptions,
    canTransferStock && online ? {} : "skip",
  );
  const categories = useCategoriesList();

  const branchFilter = isAdmin ? branchOverride : myBranchId;

  const listBranchId: Id<"branches"> | undefined = isAdmin
    ? branchOverride !== "all"
      ? branchOverride
      : undefined
    : undefined;

  const { rows } = useInventoryList({
    search,
    categoryId: categoryId !== "all" ? (categoryId as Id<"categories">) : undefined,
    branchId: listBranchId,
  });
  const history = useQuery(
    api.inventory.history,
    online && adjustId && canManageProducts
      ? { productId: adjustId, branchId: listBranchId }
      : "skip",
  );
  const adjustStock = useMutation(api.inventory.adjustStock);
  const transferStock = useMutation(api.inventory.transferStock);

  const visibleRows = useMemo(() => {
    if (!rows) return undefined;
    return expiryOnly
      ? rows.filter((row) => row.isExpired || row.isExpiring)
      : lowOnly
        ? rows.filter((row) => row.isLowStock)
        : rows;
  }, [rows, lowOnly, expiryOnly]);

  const selected = useMemo(
    () => visibleRows?.find((row) => row.id === adjustId) ?? null,
    [visibleRows, adjustId],
  );

  async function onAdjust(event: FormEvent) {
    event.preventDefault();
    if (!online) {
      toast.error("Stock adjustments require a connection");
      return;
    }
    if (!adjustId) return;
    const branchId = listBranchId ?? (adjustBranchId || null);
    if (!branchId) {
      toast.error("Select a branch for this adjustment");
      return;
    }
    try {
      await adjustStock({
        productId: adjustId,
        quantityChange: Number(quantityChange),
        reason,
        note: note || undefined,
        branchId,
        expiryDate: expiryDate || undefined,
      });
      toast.success("Stock updated");
      setAdjustId(null);
      setAdjustBranchId("");
      setQuantityChange("0");
      setNote("");
      setExpiryDate("");
    } catch (error) {
      showError(error, "Adjustment failed");
    }
  }

  function openAdjust(productId: Id<"products">) {
    setAdjustId(productId);
    setAdjustBranchId(listBranchId ?? myBranchId ?? "");
    setExpiryDate("");
  }

  function openTransfer(productId?: Id<"products">) {
    setTransferProductId(productId ?? "");
    setFromBranchId(
      isAdmin
        ? (listBranchId ?? myBranchId ?? transferBranches?.[0]?.id ?? "")
        : (myBranchId ?? ""),
    );
    setToBranchId("");
    setTransferQty("1");
    setTransferNote("");
    setTransferOpen(true);
  }

  async function onTransfer(event: FormEvent) {
    event.preventDefault();
    if (!online) {
      toast.error("Stock transfers require a connection");
      return;
    }
    if (!fromBranchId || !toBranchId || !transferProductId) {
      toast.error("Select from/to branches and a product");
      return;
    }
    try {
      await transferStock({
        fromBranchId,
        toBranchId,
        productId: transferProductId,
        quantity: Number(transferQty),
        note: transferNote || undefined,
      });
      toast.success("Stock transferred");
      setTransferOpen(false);
    } catch (error) {
      showError(error, "Transfer failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={
          expiryOnly
            ? "Showing expired and expiring lots."
            : lowOnly
              ? "Showing low-stock items only."
              : "Track available stock, low-stock, and expiry alerts."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageProducts ? (
              <Button type="button" variant="outline" asChild>
                <Link href="/wholesale">Wholesale</Link>
              </Button>
            ) : null}
            {canTransferStock ? (
              <Button type="button" variant="outline" onClick={() => openTransfer()}>
                <ArrowLeftRight className="h-4 w-4" />
                Transfer
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inventory…"
          className="max-w-md"
        />
        <SearchableSelect
          className="w-full sm:w-56"
          options={[
            { value: "all", label: "All categories" },
            ...(categories ?? []).map((category) => ({
              value: category._id,
              label: category.name,
            })),
          ]}
          value={categoryId}
          onValueChange={setCategoryId}
          placeholder="Category"
          searchPlaceholder="Search categories…"
        />
        {isAdmin ? (
          <BranchFilter
            branches={branches}
            value={branchFilter}
            onChange={setBranchOverride}
            allowAll
            className="w-full sm:w-auto"
          />
        ) : branchName ? (
          <BranchFilter
            branches={branches}
            value={myBranchId}
            onChange={() => undefined}
            lockedLabel={branchName}
            className="w-full sm:w-auto"
          />
        ) : null}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {visibleRows === undefined ? (
            <div className="p-6">
              <LoadingState label="Loading inventory…" />
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Boxes} title="No inventory rows" />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Stock</th>
                      <th className="px-4 py-3 font-medium">Expiry</th>
                      <th className="px-4 py-3 font-medium">Unit</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <ClickableTableRow key={row.id} href={`/products/${row.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-muted relative h-9 w-9 overflow-hidden rounded-md">
                              {row.imageUrl ? (
                                <Image
                                  src={row.imageUrl}
                                  alt={row.name}
                                  fill
                                  className="object-cover"
                                  sizes="36px"
                                  unoptimized
                                />
                              ) : null}
                            </div>
                            <span className="font-medium">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{row.categoryName}</td>
                        <td className="px-4 py-3">
                          <div>
                            {row.stockQuantity} {row.unit}
                            {row.tracksExpiry && row.sellableQuantity !== row.stockQuantity ? (
                              <p className="text-muted-foreground text-xs">
                                {row.sellableQuantity} sellable
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.tracksExpiry && row.nearestExpiry
                            ? formatExpiryDate(row.nearestExpiry)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 capitalize">{row.unit}</td>
                        <td className="px-4 py-3">
                          <StockStatusBadges
                            isLowStock={row.isLowStock}
                            isExpired={row.isExpired}
                            isExpiring={row.isExpiring}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              aria-label="View product details"
                            >
                              <Link href={`/products/${row.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {canManageProducts ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openAdjust(row.id)}
                              >
                                Adjust
                              </Button>
                            ) : null}
                            {canTransferStock ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => openTransfer(row.id)}
                              >
                                Transfer
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-3 md:hidden">
                {visibleRows.map((row) => (
                  <div key={row.id} className="border-border space-y-2 rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/products/${row.id}`} className="font-medium hover:underline">
                        {row.name}
                      </Link>
                      <StockStatusBadges
                        isLowStock={row.isLowStock}
                        isExpired={row.isExpired}
                        isExpiring={row.isExpiring}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">{row.categoryName}</p>
                    <p className="text-sm">
                      {row.stockQuantity} {row.unit}
                      {row.tracksExpiry && row.nearestExpiry
                        ? ` · ${formatExpiryDate(row.nearestExpiry)}`
                        : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/products/${row.id}`}>
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      {canManageProducts ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjust(row.id)}
                        >
                          Adjust
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!adjustId} onOpenChange={(open) => !open && setAdjustId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock{selected ? ` · ${selected.name}` : ""}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onAdjust}>
            {isAdmin && !listBranchId ? (
              <div className="space-y-2">
                <Label>Branch</Label>
                <SearchableSelect
                  options={(branches ?? []).map((b) => ({
                    value: b.id,
                    label: b.name,
                    keywords: b.code,
                  }))}
                  value={adjustBranchId || undefined}
                  onValueChange={(v) => setAdjustBranchId(v as Id<"branches">)}
                  placeholder="Select branch"
                  searchPlaceholder="Search branches…"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity change</Label>
              <Input
                id="qty"
                type="number"
                step="1"
                value={quantityChange}
                onChange={(e) => setQuantityChange(e.target.value)}
                required
              />
            </div>
            {selected?.tracksExpiry && Number(quantityChange) > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry date</Label>
                <Input
                  id="expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receive">Found stock</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {history && history.length > 0 ? (
              <div className="space-y-2">
                <Label>Recent history</Label>
                <ul className="border-border max-h-36 space-y-1.5 overflow-y-auto rounded-md border p-2 text-xs">
                  {history.slice(0, 8).map((row) => (
                    <li key={row._id} className="flex justify-between gap-2">
                      <span className="text-muted-foreground capitalize">
                        {row.reason}
                        {row.note ? ` · ${row.note}` : ""}
                      </span>
                      <span className="font-medium tabular-nums">
                        {row.quantityChange > 0 ? "+" : ""}
                        {row.quantityChange} → {row.quantityAfter}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustId(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer stock</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onTransfer}>
            <div className="space-y-2">
              <Label>From branch</Label>
              <SearchableSelect
                options={(transferBranches ?? []).map((b) => ({
                  value: b.id,
                  label: b.name,
                  keywords: b.code,
                }))}
                value={fromBranchId || undefined}
                onValueChange={(v) => setFromBranchId(v as Id<"branches">)}
                disabled={!isAdmin}
                placeholder="From"
                searchPlaceholder="Search branches…"
              />
            </div>
            <div className="space-y-2">
              <Label>To branch</Label>
              <SearchableSelect
                options={(transferBranches ?? [])
                  .filter((b) => b.id !== fromBranchId)
                  .map((b) => ({
                    value: b.id,
                    label: b.name,
                    keywords: b.code,
                  }))}
                value={toBranchId || undefined}
                onValueChange={(v) => setToBranchId(v as Id<"branches">)}
                placeholder="To"
                searchPlaceholder="Search branches…"
              />
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <SearchableSelect
                options={(rows ?? []).map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.stockQuantity})`,
                  keywords: p.sku,
                }))}
                value={transferProductId || undefined}
                onValueChange={(v) => setTransferProductId(v as Id<"products">)}
                placeholder="Product"
                searchPlaceholder="Search products…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-qty">Quantity</Label>
              <Input
                id="transfer-qty"
                type="number"
                min="1"
                step="1"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-note">Note</Label>
              <Input
                id="transfer-note"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Transfer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InventoryView() {
  return (
    <Suspense fallback={<LoadingState label="Loading inventory…" />}>
      <InventoryViewInner />
    </Suspense>
  );
}
