"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { PlanLimitNotice } from "@/features/billing/components/plan-limit-notice";
import { Button } from "@/components/ui/button";
import { BarcodeSearchField } from "@/components/hardware/barcode-search-field";
import { Card, CardContent } from "@/components/ui/card";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { formatCurrency } from "@/lib/currency";
import { Download, Eye, Package, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ProductFormDialog } from "./product-form-dialog";
import { StockStatusBadges } from "@/features/inventory/components/stock-status-badges";
import { usePermissions } from "@/hooks/use-permissions";
import { exportCsv } from "@/services";
import { BranchFilter } from "@/components/filters/branch-filter";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useProductsList } from "@/hooks/use-offline-lists";
import { ProductImage } from "@/components/media/product-image";

export function ProductsView() {
  const {
    canManageProducts,
    canViewCost,
    isAdmin,
    branchId: myBranchId,
    branchName,
  } = usePermissions();
  const online = useConnectivity();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"products"> | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: Id<"products">;
    name: string;
  } | null>(null);
  const [archivePending, setArchivePending] = useState(false);
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "all" | null>(myBranchId);
  const branches = useQuery(api.branches.list, isAdmin && online ? {} : "skip");
  const { products, loading: isLoading } = useProductsList({
    search,
    includeInactive: canManageProducts,
    branchId: isAdmin && branchFilter && branchFilter !== "all" ? branchFilter : undefined,
    canViewCost,
  });
  const archiveProduct = useMutation(api.products.archiveProduct);

  const rows = useMemo(() => products ?? [], [products]);

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchivePending(true);
    try {
      await archiveProduct({ id: archiveTarget.id });
      toast.success("Product archived");
      setArchiveTarget(null);
    } catch (error) {
      showError(error, "Archive failed");
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description={
          canManageProducts
            ? "Manage catalog, pricing, and stock thresholds."
            : "Browse the product catalog for your branch."
        }
        actions={
          canManageProducts ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void exportCsv(
                    "products.csv",
                    rows.map((r) => ({ name: r.name, sku: r.sku, stock: r.stockQuantity })),
                  ).then(() => toast.success("Export downloaded"))
                }
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            </>
          ) : undefined
        }
      />

      <PlanLimitNotice resource="products" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <BarcodeSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search products or scan barcode…"
          listenHid={!open}
        />
        {isAdmin ? (
          <BranchFilter
            branches={branches}
            value={branchFilter}
            onChange={setBranchFilter}
            allowAll
          />
        ) : branchName ? (
          <BranchFilter
            branches={branches}
            value={myBranchId}
            onChange={() => undefined}
            lockedLabel={branchName}
          />
        ) : null}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="p-6">
              <LoadingState label="Loading products…" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Package}
                title="No products yet"
                description={
                  canManageProducts
                    ? "Add your first product to start selling."
                    : "No products are available in the catalog yet."
                }
                action={
                  canManageProducts ? (
                    <Button type="button" onClick={() => setOpen(true)}>
                      Add Product
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Selling Price</th>
                      {canViewCost ? <th className="px-4 py-3 font-medium">Cost Price</th> : null}
                      <th className="px-4 py-3 font-medium">Stock</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((product) => (
                      <ClickableTableRow key={product.id} href={`/products/${product.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-muted relative h-10 w-10 overflow-hidden rounded-md">
                              <ProductImage
                                productId={product.id}
                                remoteUrl={product.imageUrl}
                                alt={product.name}
                                sizes="40px"
                                fallback={<Package className="text-muted-foreground m-auto h-5 w-5" />}
                              />
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-muted-foreground text-xs">
                                {product.sku}
                                {product.barcode ? ` · ${product.barcode}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{product.categoryName}</td>
                        <td className="px-4 py-3">{formatCurrency(product.sellingPrice)}</td>
                        {canViewCost ? (
                          <td className="px-4 py-3">
                            {product.costPrice !== undefined
                              ? formatCurrency(product.costPrice)
                              : "—"}
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          {product.stockQuantity} {product.unit}
                        </td>
                        <td className="px-4 py-3">
                          <StockStatusBadges
                            isLowStock={product.isLowStock}
                            isExpired={product.isExpired}
                            isExpiring={product.isExpiring}
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
                              <Link href={`/products/${product.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {canManageProducts ? (
                              <>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Edit product"
                                  onClick={() => {
                                    setEditingId(product.id);
                                    setOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Archive product"
                                  onClick={() =>
                                    setArchiveTarget({ id: product.id, name: product.name })
                                  }
                                >
                                  <Trash2 className="text-destructive h-4 w-4" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-3 md:hidden">
                {rows.map((product) => (
                  <div key={product.id} className="border-border rounded-xl border p-3">
                    <div className="flex gap-3">
                      <div className="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-md">
                        <ProductImage
                          productId={product.id}
                          remoteUrl={product.imageUrl}
                          alt={product.name}
                          sizes="56px"
                          fallback={<Package className="text-muted-foreground m-auto h-5 w-5" />}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-medium hover:underline"
                        >
                          {product.name}
                        </Link>
                        <p className="text-muted-foreground text-xs">{product.categoryName}</p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatCurrency(product.sellingPrice)}
                        </p>
                        <div className="mt-2">
                          <StockStatusBadges
                            isLowStock={product.isLowStock}
                            isExpired={product.isExpired}
                            isExpiring={product.isExpiring}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className={`mt-3 grid gap-2 ${canManageProducts ? "grid-cols-3" : "grid-cols-1"}`}
                    >
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/products/${product.id}`}>View</Link>
                      </Button>
                      {canManageProducts ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(product.id);
                              setOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setArchiveTarget({ id: product.id, name: product.name })}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {canManageProducts ? (
        <>
          <ConfirmDialog
            open={!!archiveTarget}
            onOpenChange={(open) => !open && setArchiveTarget(null)}
            title="Archive product?"
            description={
              archiveTarget
                ? `“${archiveTarget.name}” will be archived and removed from the active catalog. This cannot be undone from the list.`
                : ""
            }
            confirmLabel="Archive"
            pending={archivePending}
            onConfirm={confirmArchive}
          />

          <ProductFormDialog open={open} onOpenChange={setOpen} productId={editingId} />
        </>
      ) : null}
    </div>
  );
}
