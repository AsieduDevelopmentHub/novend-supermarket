"use client";

import { FormEvent, useEffect, useMemo, useState, Suspense } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader, Grid, type PageHeaderCompactAction } from "@/components/layout/primitives";
import { BarcodeSearchField } from "@/components/hardware/barcode-search-field";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnsignedQuantityInput } from "@/components/ui/unsigned-quantity-input";
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
import { CollapsibleFilters } from "@/components/filters/collapsible-filters";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useCategoriesList, useInventoryList, useBranchesList } from "@/hooks/use-offline-lists";
import { StockStatusBadges } from "@/features/inventory/components/stock-status-badges";
import { expiryAlertQuantity, formatExpiryDate } from "@/lib/expiry";
import { signedStockDelta } from "@/lib/quantity";
import {
  alignDirectionToReason,
  alignReasonToDirection,
  type StockAdjustReason,
  type StockDirection,
} from "@/features/inventory/stock-adjust";
import { ArrowLeftRight, Boxes, Eye, Package, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/media/product-image";
import { ListPagination } from "@/components/ui/list-pagination";
import { useClientPagedRows } from "@/hooks/use-ui";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { findLocalProductsByBarcode } from "@/lib/offline/snapshot";
import { listMirroredProducts } from "@/lib/offline/mirror-queries";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { isBarcodeScanningEnabled } from "@/services/hardware";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueAdjustStock,
  queueTransferStock,
} from "@/lib/offline/replica-writes";

function InventoryViewInner() {
  const {
    isAdmin,
    canManageProducts,
    canTransferStock,
    branchId: myBranchId,
    branchName,
  } = usePermissions();
  const online = useConnectivity();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");
  const branchParam = searchParams.get("branch");
  const lowOnly = filter === "low";
  const expiryOnly = filter === "expiry";
  const stockFilter = lowOnly ? "low" : expiryOnly ? "expiry" : "all";
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  /** Admin override; default `all` = organization-wide stock totals. */
  const [branchOverride, setBranchOverride] = useState<Id<"branches"> | "all">(() =>
    branchParam && branchParam !== "all" ? (branchParam as Id<"branches">) : "all",
  );
  const [landedWithStockAlert] = useState(lowOnly || expiryOnly);
  const [alertScopeApplied, setAlertScopeApplied] = useState(
    Boolean(branchParam && branchParam !== "all"),
  );
  const [adjustId, setAdjustId] = useState<Id<"products"> | null>(null);
  const [adjustBranchId, setAdjustBranchId] = useState<Id<"branches"> | "">("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<StockDirection>("add");
  const [reason, setReason] = useState<StockAdjustReason>("receive");
  const [note, setNote] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [fromBranchId, setFromBranchId] = useState<Id<"branches"> | "">("");
  const [toBranchId, setToBranchId] = useState<Id<"branches"> | "">("");
  const [transferProductId, setTransferProductId] = useState<Id<"products"> | "">("");
  const [transferQty, setTransferQty] = useState("1");
  const [transferNote, setTransferNote] = useState("");
  const [transferSourceRows, setTransferSourceRows] = useState<
    Array<{ id: string; name: string; sku: string; stockQuantity: number }>
  >([]);

  useEffect(() => {
    if (!transferOpen || !fromBranchId) {
      queueMicrotask(() => setTransferSourceRows([]));
      return;
    }
    let cancelled = false;
    const load = () => {
      void listMirroredProducts({ branchId: fromBranchId, includeInactive: false }).then((rows) => {
        if (cancelled || rows == null || !Array.isArray(rows)) return;
        setTransferSourceRows(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            stockQuantity: row.sellableQuantity ?? row.stockQuantity,
          })),
        );
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [transferOpen, fromBranchId]);

  if (branchParam && branchParam !== "all") {
    const fromUrl = branchParam as Id<"branches">;
    if (branchOverride !== fromUrl) setBranchOverride(fromUrl);
    if (!alertScopeApplied) setAlertScopeApplied(true);
  } else if (!alertScopeApplied && landedWithStockAlert) {
    // Dashboard stock/expiry links intentionally open org-wide (all branches).
    setAlertScopeApplied(true);
    setBranchOverride("all");
  }

  function replaceInventoryQuery(next: { filter?: string | null; branch?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.filter === undefined) {
      /* keep */
    } else if (next.filter) {
      params.set("filter", next.filter);
    } else {
      params.delete("filter");
    }
    if (next.branch === undefined) {
      /* keep */
    } else if (next.branch && next.branch !== "all") {
      params.set("branch", next.branch);
    } else {
      params.delete("branch");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const branches = useBranchesList(false);
  const transferBranches = branches;
  const categories = useCategoriesList();

  const branchFilter = isAdmin ? branchOverride : myBranchId;

  const listBranchId: Id<"branches"> | undefined = isAdmin
    ? branchOverride !== "all"
      ? branchOverride
      : undefined
    : undefined;

  const valuation = useQuery(
    api.inventory.valuationSummary,
    online ? { branchId: listBranchId } : "skip",
  );

  const { rows } = useInventoryList({
    search,
    categoryId: categoryId !== "all" ? (categoryId as Id<"categories">) : undefined,
    branchId: listBranchId,
  });

  const transferProductOptions = useMemo(() => {
    const source = transferSourceRows.length > 0 ? transferSourceRows : (rows ?? []);
    return source.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.stockQuantity})`,
      keywords: p.sku,
    }));
  }, [transferSourceRows, rows]);

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
    const expandOrgAlerts = isAdmin && branchOverride === "all" && (lowOnly || expiryOnly);

    if (expandOrgAlerts) {
      return rows.flatMap((row) => {
        const branches = row.alertBranches ?? [];
        const matching = branches.filter((branch) =>
          lowOnly ? branch.isLowStock : branch.isExpired || branch.isExpiring,
        );
        if (matching.length === 0) {
          if (lowOnly ? row.isLowStock : row.isExpired || row.isExpiring) {
            return [{ ...row, rowKey: String(row.id) }];
          }
          return [];
        }
        return matching.map((branch) => ({
          ...row,
          rowKey: `${row.id}:${branch.branchId}`,
          stockQuantity: branch.sellableQuantity,
          sellableQuantity: branch.sellableQuantity,
          expiredQuantity: branch.expiredQuantity,
          expiringQuantity: branch.expiringQuantity,
          nearestExpiry: branch.nearestExpiry ?? row.nearestExpiry,
          isLowStock: branch.isLowStock,
          isExpired: branch.isExpired,
          isExpiring: branch.isExpiring,
          branchId: branch.branchId,
          branchName: branch.branchName,
          statusLabel: branch.isExpired
            ? "Expired"
            : branch.isExpiring
              ? "Expiring"
              : branch.isLowStock
                ? "Low Stock"
                : row.statusLabel,
        }));
      });
    }

    return expiryOnly
      ? rows.filter((row) => row.isExpired || row.isExpiring)
      : lowOnly
        ? rows.filter((row) => row.isLowStock)
        : rows;
  }, [rows, lowOnly, expiryOnly, isAdmin, branchOverride]);
  const {
    paged: pageRows,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
  } = useClientPagedRows(
    visibleRows,
    `${search}|${categoryId}|${String(listBranchId)}|${lowOnly}|${expiryOnly}`,
  );

  const selected = useMemo(
    () => visibleRows?.find((row) => row.id === adjustId) ?? null,
    [visibleRows, adjustId],
  );

  useBarcodeScanner(
    (code) => {
      if (!transferOpen) return;
      void findLocalProductsByBarcode(code).then((matches) => {
        if (matches.length === 1) {
          setTransferProductId(matches[0]!.id as Id<"products">);
          toast.success(`Selected ${matches[0]!.name}`);
          return;
        }
        if (matches.length === 0) {
          toast.error("Product not found");
          return;
        }
        setSearch(code);
      });
    },
    { enabled: transferOpen && isBarcodeScanningEnabled(), allowInInputs: true },
  );

  async function onAdjust(event: FormEvent) {
    event.preventDefault();
    if (!adjustId) return;
    const branchId = listBranchId ?? (adjustBranchId || null);
    if (!branchId) {
      toast.error("Select a branch for this adjustment");
      return;
    }
    const quantityChange = signedStockDelta(direction, quantity);
    if (quantityChange === null) {
      toast.error("Enter how many units to add or remove");
      return;
    }
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          adjustStock({
            productId: adjustId,
            quantityChange,
            reason,
            note: note || undefined,
            branchId,
            expiryDate: expiryDate || undefined,
          }),
        local: () =>
          queueAdjustStock({
            productId: adjustId,
            branchId,
            quantityChange,
            reason,
            note: note || undefined,
            expiryDate: expiryDate || undefined,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Stock updated"));
      setAdjustId(null);
      setAdjustBranchId("");
      setQuantity("");
      setDirection("add");
      setReason("receive");
      setNote("");
      setExpiryDate("");
    } catch (error) {
      showError(error, "Adjustment failed");
    }
  }

  function openAdjust(productId: Id<"products">, branchId?: Id<"branches"> | null) {
    setAdjustId(productId);
    setAdjustBranchId(branchId ?? listBranchId ?? myBranchId ?? "");
    setQuantity("");
    setDirection("add");
    setReason("receive");
    setExpiryDate("");
  }

  function openTransfer(productId?: Id<"products">) {
    setTransferProductId(productId ?? "");
    setFromBranchId(
      (isAdmin
        ? (listBranchId ?? myBranchId ?? transferBranches?.[0]?.id ?? "")
        : (myBranchId ?? "")) as Id<"branches"> | "",
    );
    setToBranchId("");
    setTransferQty("1");
    setTransferNote("");
    setTransferOpen(true);
  }

  async function onTransfer(event: FormEvent) {
    event.preventDefault();
    if (!fromBranchId || !toBranchId || !transferProductId) {
      toast.error("Select from/to branches and a product");
      return;
    }
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          transferStock({
            fromBranchId,
            toBranchId,
            productId: transferProductId,
            quantity: Number(transferQty),
            note: transferNote || undefined,
          }),
        local: () =>
          queueTransferStock({
            fromBranchId,
            toBranchId,
            productId: transferProductId,
            quantity: Number(transferQty),
            note: transferNote || undefined,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Stock transferred"));
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
            ? branchOverride === "all" && isAdmin
              ? "Showing expired and expiring lots."
              : "Showing expired and expiring lots at this branch."
            : lowOnly
              ? branchOverride === "all" && isAdmin
                ? "Showing low-stock items."
                : "Showing low-stock items at this branch."
              : "Track available stock, low-stock, and expiry alerts."
        }
        compactActions={
          [
            ...(canManageProducts
              ? [
                  {
                    key: "wholesale",
                    label: "Wholesale",
                    icon: Package,
                    href: "/wholesale",
                  } satisfies PageHeaderCompactAction,
                ]
              : []),
            ...(canTransferStock
              ? [
                  {
                    key: "transfer",
                    label: "Transfer",
                    icon: ArrowLeftRight,
                    onClick: () => openTransfer(),
                  } satisfies PageHeaderCompactAction,
                ]
              : []),
          ] satisfies PageHeaderCompactAction[]
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

      {valuation ? (
        <div className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Inventory &amp; profit
          </h2>
          <Grid cols={valuation.inventoryValueCost != null ? 3 : 1}>
            {valuation.inventoryValueCost != null ? (
              <Card>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Inventory value (cost)</p>
                    <p className="mt-1 truncate text-2xl font-semibold tracking-tight">
                      {formatCurrency(valuation.inventoryValueCost)}
                    </p>
                  </div>
                  <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <Package className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm">Inventory value (sell)</p>
                  <p className="mt-1 truncate text-2xl font-semibold tracking-tight">
                    {formatCurrency(valuation.inventoryValueSell)}
                  </p>
                </div>
                <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Wallet className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            {valuation.possibleProfit != null ? (
              <Card>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Possible profit after sales</p>
                    <p
                      className={cn(
                        "mt-1 truncate text-2xl font-semibold tracking-tight",
                        valuation.possibleProfit < 0 && "text-destructive",
                      )}
                    >
                      {formatCurrency(valuation.possibleProfit)}
                    </p>
                  </div>
                  <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </Grid>
        </div>
      ) : null}

      <div data-tour="inventory-filters" className="space-y-3">
        <BarcodeSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search inventory or scan barcode…"
          listenHid={!adjustId && !transferOpen}
        />
        <CollapsibleFilters
          defaultOpen={stockFilter !== "all"}
          activeCount={
            (categoryId !== "all" ? 1 : 0) +
            (isAdmin && branchOverride !== "all" ? 1 : 0) +
            (stockFilter !== "all" ? 1 : 0)
          }
          onReset={() => {
            setCategoryId("all");
            if (isAdmin) setBranchOverride("all");
            replaceInventoryQuery({ filter: null, branch: null });
          }}
        >
          <Select
            value={stockFilter}
            onValueChange={(value) => {
              replaceInventoryQuery({
                filter: value === "low" || value === "expiry" ? value : null,
              });
            }}
          >
            <SelectTrigger className="min-h-11 w-full sm:w-48" aria-label="Stock status">
              <SelectValue placeholder="Stock status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="expiry">Expiring / expired</SelectItem>
            </SelectContent>
          </Select>
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
              onChange={(value) => {
                setBranchOverride(value);
                setAlertScopeApplied(true);
                replaceInventoryQuery({ branch: value === "all" ? null : String(value) });
              }}
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

      <Card data-tour="inventory-summary">
        <CardContent className="overflow-x-auto p-0">
          {visibleRows === undefined ? (
            <div className="p-6">
              <LoadingState label="Loading inventory…" />
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Boxes}
                title={
                  expiryOnly
                    ? "No expiring lots"
                    : lowOnly
                      ? "No low-stock items"
                      : "No inventory yet"
                }
                description={
                  !expiryOnly && !lowOnly && canManageProducts
                    ? "Add products to start tracking stock."
                    : undefined
                }
                action={
                  !expiryOnly && !lowOnly && canManageProducts ? (
                    <Button asChild>
                      <Link href="/products">Add product</Link>
                    </Button>
                  ) : undefined
                }
              />
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
                    {(pageRows ?? []).map((row) => (
                      <ClickableTableRow key={row.rowKey ?? row.id} href={`/products/${row.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-muted relative h-9 w-9 overflow-hidden rounded-md">
                              <ProductImage
                                productId={row.id}
                                remoteUrl={row.imageUrl}
                                alt={row.name}
                                sizes="36px"
                              />
                            </div>
                            <div>
                              <span className="font-medium">{row.name}</span>
                              {row.branchName ? (
                                <p className="text-muted-foreground text-xs">{row.branchName}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{row.categoryName}</td>
                        <td className="px-4 py-3">
                          <div>
                            {expiryOnly ? (
                              <>
                                {expiryAlertQuantity(row)} {row.unit}
                                <p className="text-muted-foreground text-xs">
                                  {[
                                    row.isExpired && row.expiredQuantity
                                      ? `${row.expiredQuantity} expired`
                                      : null,
                                    row.isExpiring && row.expiringQuantity
                                      ? `${row.expiringQuantity} expiring`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "Alert window"}
                                  {row.sellableQuantity != null &&
                                  row.sellableQuantity !== expiryAlertQuantity(row)
                                    ? ` · ${row.sellableQuantity} sellable`
                                    : ""}
                                </p>
                              </>
                            ) : (
                              <>
                                {row.stockQuantity} {row.unit}
                                {row.tracksExpiry && row.sellableQuantity !== row.stockQuantity ? (
                                  <p className="text-muted-foreground text-xs">
                                    {row.sellableQuantity} sellable
                                  </p>
                                ) : null}
                              </>
                            )}
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
                                data-tour="inventory-adjustment"
                                onClick={() => openAdjust(row.id, row.branchId)}
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
              {total > 0 ? (
                <ListPagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              ) : null}

              <div className="space-y-3 p-3 md:hidden">
                {(pageRows ?? []).map((row) => (
                  <div
                    key={row.rowKey ?? row.id}
                    className="border-border space-y-2 rounded-xl border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/products/${row.id}`} className="font-medium hover:underline">
                          {row.name}
                        </Link>
                        {row.branchName ? (
                          <p className="text-muted-foreground text-xs">{row.branchName}</p>
                        ) : null}
                      </div>
                      <StockStatusBadges
                        isLowStock={row.isLowStock}
                        isExpired={row.isExpired}
                        isExpiring={row.isExpiring}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">{row.categoryName}</p>
                    <p className="text-sm">
                      {expiryOnly ? expiryAlertQuantity(row) : row.stockQuantity} {row.unit}
                      {row.tracksExpiry && row.nearestExpiry
                        ? ` · ${formatExpiryDate(row.nearestExpiry)}`
                        : ""}
                      {expiryOnly &&
                      row.sellableQuantity != null &&
                      row.sellableQuantity !== expiryAlertQuantity(row)
                        ? ` · ${row.sellableQuantity} sellable`
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
                          data-tour="inventory-adjustment"
                          onClick={() => openAdjust(row.id, row.branchId)}
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
              <Label>Direction</Label>
              <Tabs
                value={direction}
                onValueChange={(value) => {
                  const next = value as StockDirection;
                  setDirection(next);
                  setReason(alignReasonToDirection(next, reason));
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="add" className="flex-1">
                    Add stock
                  </TabsTrigger>
                  <TabsTrigger value="remove" className="flex-1">
                    Remove stock
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity</Label>
              <UnsignedQuantityInput
                id="qty"
                value={quantity}
                onValueChange={setQuantity}
                placeholder="How many units"
                required
              />
            </div>
            {selected?.tracksExpiry && direction === "add" ? (
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
              <Select
                value={reason}
                onValueChange={(value) => {
                  const next = value as StockAdjustReason;
                  setReason(next);
                  setDirection(alignDirectionToReason(next, direction));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {direction === "add" ? (
                    <>
                      <SelectItem value="receive">Found stock</SelectItem>
                      <SelectItem value="return">Customer return</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="damage">Damage</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </>
                  )}
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
                options={transferProductOptions}
                value={transferProductId || undefined}
                onValueChange={(v) => setTransferProductId(v as Id<"products">)}
                placeholder="Product"
                searchPlaceholder="Search products…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-qty">Quantity</Label>
              <UnsignedQuantityInput
                id="transfer-qty"
                value={transferQty}
                onValueChange={setTransferQty}
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
