"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
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
import { Eye, MoreVertical, Package, Pencil, Plus, Trash2, Upload, Warehouse } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductImportWizard } from "./product-import-wizard";
import { ResolveDuplicatesDialog } from "./resolve-duplicates-dialog";
import { StockStatusBadges } from "@/features/inventory/components/stock-status-badges";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { useLicense } from "@/hooks/use-license";
import { BranchFilter } from "@/components/filters/branch-filter";
import { CollapsibleFilters } from "@/components/filters/collapsible-filters";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useBranchesList, useCategoriesList, useProductsList } from "@/hooks/use-offline-lists";
import { ProductImage } from "@/components/media/product-image";
import { ExportMenu } from "@/components/export/export-menu";
import { productExportTable } from "@/lib/export/products";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { triggerLightHaptic } from "@/lib/haptics";
import { useRouter } from "next/navigation";
import { ListPagination } from "@/components/ui/list-pagination";
import { useDebounce, useLocalStorage, usePagination } from "@/hooks/use-ui";
import {
  clampListPageSize,
  DEFAULT_LIST_PAGE_SIZE,
  type ListPageSize,
} from "@/constants/list-page";
import { FULLY_OFFLINE } from "@/constants/runtime";
import {
  persistBusinessWrite,
  queueArchiveProduct,
  queuedSaveMessage,
} from "@/lib/offline/replica-writes";
import { useConnectivity } from "@/hooks/use-connectivity";

export function ProductsView() {
  const {
    canManageProducts,
    canViewCost,
    isAdmin,
    branchId: myBranchId,
    branchName,
  } = usePermissions();
  const { capabilities, planName } = useLicense();
  const router = useRouter();
  const online = useConnectivity();
  const [search, setSearch] = useState("");
  /** Immediate for barcode scans; debounced for typing so Dexie isn't hit every key. */
  const [immediateSearch, setImmediateSearch] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 280);
  const listSearch = immediateSearch ?? debouncedSearch;
  const [categoryId, setCategoryId] = useState<string>("all");
  const [storedPageSize, setStoredPageSize] = useLocalStorage(
    "novend.listPageSize",
    DEFAULT_LIST_PAGE_SIZE,
  );
  const pageSize = clampListPageSize(storedPageSize);
  const { page, setPage, reset } = usePagination(1, pageSize);
  const [open, setOpen] = useState(false);
  const [resolveDupesOpen, setResolveDupesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportWanted, setExportWanted] = useState(false);
  const [editingId, setEditingId] = useState<Id<"products"> | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: Id<"products">;
    name: string;
  } | null>(null);
  const [archivePending, setArchivePending] = useState(false);
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "all" | null>(myBranchId);
  const mirroredBranches = useBranchesList();
  const categories = useCategoriesList();
  const branches = isAdmin ? mirroredBranches : undefined;
  const listBranchId = isAdmin && branchFilter && branchFilter !== "all" ? branchFilter : undefined;
  const listCategoryId =
    categoryId !== "all" ? (categoryId as Id<"categories">) : undefined;
  const {
    products,
    total,
    loading: isLoading,
  } = useProductsList({
    search: listSearch,
    includeInactive: canManageProducts,
    branchId: listBranchId,
    categoryId: listCategoryId,
    canViewCost,
    page,
    pageSize,
  });
  const { products: exportRows } = useProductsList({
    search: listSearch,
    includeInactive: canManageProducts,
    branchId: listBranchId,
    categoryId: listCategoryId,
    canViewCost,
    enabled: exportWanted,
  });
  const archiveProductRemote = useMutation(api.products.archiveProduct);
  const recordExport = useMutation(api.imports.recordExport);

  const rows = useMemo(() => products ?? [], [products]);

  useEffect(() => {
    reset();
  }, [listSearch, branchFilter, categoryId, reset]);

  useEffect(() => {
    if (immediateSearch != null && debouncedSearch === immediateSearch) {
      setImmediateSearch(null);
    }
  }, [debouncedSearch, immediateSearch]);

  const exportTable = useMemo(
    () =>
      exportWanted
        ? productExportTable({
            rows: exportRows ?? [],
            canViewCost,
            branchLabel:
              isAdmin && branchFilter && branchFilter !== "all"
                ? undefined
                : (branchName ?? undefined),
          })
        : null,
    [exportWanted, exportRows, canViewCost, isAdmin, branchFilter, branchName],
  );

  function onSearchChange(value: string) {
    setImmediateSearch(null);
    setSearch(value);
  }

  function onBarcodeScan(code: string) {
    setSearch(code);
    setImmediateSearch(code);
  }

  function onPageChange(next: number) {
    startTransition(() => setPage(next));
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchivePending(true);
    try {
      if (FULLY_OFFLINE) {
        const kind = await persistBusinessWrite({
          online,
          remote: () => archiveProductRemote({ id: archiveTarget.id }),
          local: () => queueArchiveProduct(String(archiveTarget.id)),
        });
        toast.success(queuedSaveMessage(kind, "Product archived"));
      } else {
        await archiveProductRemote({ id: archiveTarget.id });
        toast.success("Product archived");
      }
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
        compactActions={
          canManageProducts
            ? [
                {
                  key: "import",
                  label: "Import",
                  icon: Upload,
                  onClick: () => setImportOpen(true),
                },
                {
                  key: "add",
                  label: "Add Product",
                  icon: Plus,
                  onClick: () => {
                    setEditingId(null);
                    setOpen(true);
                  },
                },
              ]
            : undefined
        }
        actions={
          canManageProducts ? (
            <>
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <span
                onPointerDown={() => setExportWanted(true)}
                onFocusCapture={() => setExportWanted(true)}
              >
                <ExportMenu
                  table={exportTable}
                  capabilities={capabilities}
                  planName={planName}
                  disabled={rows.length === 0 && !exportWanted}
                  onExported={(format, count) => {
                    void recordExport({ kind: "products", format, rowCount: count }).catch(
                      () => undefined,
                    );
                  }}
                />
              </span>
              {FULLY_OFFLINE ? (
                <Button
                  type="button"
                  variant="outline"
                  data-tour="products-resolve-duplicates"
                  onClick={() => setResolveDupesOpen(true)}
                >
                  Resolve duplicates
                </Button>
              ) : null}
              <Button
                type="button"
                data-tour="products-add"
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

      <div data-tour="products-search">
        <CollapsibleFilters
          leading={
            <BarcodeSearchField
              value={search}
              onChange={onSearchChange}
              onScan={onBarcodeScan}
              placeholder="Search products or scan barcode…"
              listenHid={!open}
            />
          }
          activeCount={
            (categoryId !== "all" ? 1 : 0) + (isAdmin && branchFilter && branchFilter !== "all" ? 1 : 0)
          }
          onReset={() => {
            setCategoryId("all");
            if (isAdmin) setBranchFilter("all");
          }}
        >
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
              onChange={setBranchFilter}
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
        </CollapsibleFilters>
      </div>

      <Card data-tour="products-list">
        <CardContent className="overflow-x-auto p-0">
          {isLoading && rows.length === 0 ? (
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
                      <th className="px-4 py-3 font-medium">Catalogue</th>
                      <th className="px-4 py-3 font-medium">Availability</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((product) => (
                      <ClickableTableRow key={product.id} href={`/products/${product.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-muted relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                              <ProductImage
                                productId={product.id}
                                remoteUrl={product.imageUrl}
                                alt={product.name}
                                sizes="40px"
                                fallback={
                                  <Package className="text-muted-foreground absolute inset-0 m-auto h-5 w-5" />
                                }
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
                          {product.tracksInventory === false
                            ? "—"
                            : `${product.stockQuantity} ${product.unit}`}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={product.status === "active" ? "success" : "secondary"}>
                            {product.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {product.tracksInventory === false ? (
                            <Badge variant="outline">Non-stock</Badge>
                          ) : (
                            <StockStatusBadges
                              isLowStock={product.isLowStock}
                              isExpired={product.tracksExpiry ? product.isExpired : false}
                              isExpiring={product.tracksExpiry ? product.isExpiring : false}
                            />
                          )}
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

              {total > 0 ? (
                <ListPagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={onPageChange}
                  onPageSizeChange={(size: ListPageSize) => {
                    setStoredPageSize(size);
                    startTransition(() => setPage(1));
                  }}
                />
              ) : null}
              <div className="space-y-3 p-3 md:hidden">
                {rows.map((product) => (
                  <div
                    key={product.id}
                    className="border-border rounded-[20px] border p-3"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      void triggerLightHaptic();
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px]">
                        <ProductImage
                          productId={product.id}
                          remoteUrl={product.imageUrl}
                          alt={product.name}
                          sizes="64px"
                          fallback={
                            <Package className="text-muted-foreground absolute inset-0 m-auto h-5 w-5" />
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/products/${product.id}`}
                              className="block truncate font-medium hover:underline"
                            >
                              {product.name}
                            </Link>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              SKU {product.sku}
                              {product.categoryName ? ` · ${product.categoryName}` : ""}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-11 shrink-0"
                                aria-label="Product actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/products/${product.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View details
                                </Link>
                              </DropdownMenuItem>
                              {canManageProducts ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingId(product.id);
                                      setOpen(true);
                                    }}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  {product.tracksInventory === false ? null : (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        router.push(
                                          `/inventory?q=${encodeURIComponent(product.sku)}`,
                                        )
                                      }
                                    >
                                      <Warehouse className="mr-2 h-4 w-4" />
                                      Adjust stock
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() =>
                                      setArchiveTarget({ id: product.id, name: product.name })
                                    }
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">
                            {formatCurrency(product.sellingPrice)}
                          </p>
                          {product.tracksInventory === false ? (
                            <Badge variant="outline">Non-stock</Badge>
                          ) : (
                            <p className="text-muted-foreground text-xs">
                              Stock {product.stockQuantity}
                            </p>
                          )}
                          <Badge variant={product.status === "active" ? "success" : "secondary"}>
                            {product.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                          {product.tracksInventory === false ? null : (
                            <StockStatusBadges
                              isLowStock={product.isLowStock}
                              isExpired={product.tracksExpiry ? product.isExpired : false}
                              isExpiring={product.tracksExpiry ? product.isExpiring : false}
                            />
                          )}
                        </div>
                      </div>
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

          <ProductImportWizard open={importOpen} onOpenChange={setImportOpen} />
          <ResolveDuplicatesDialog open={resolveDupesOpen} onOpenChange={setResolveDupesOpen} />
          <ProductFormDialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setEditingId(null);
            }}
            productId={editingId}
          />
        </>
      ) : null}
    </div>
  );
}
