"use client";

import { FormEvent, useEffect, useMemo, useState, Suspense } from "react";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { PageHeader, Grid, type PageHeaderCompactAction } from "@/components/layout/primitives";
import { BarcodeSearchField } from "@/components/hardware/barcode-search-field";
import {
  loadOfflineInventoryValuation,
  type OfflineInventoryValuation,
} from "@/lib/offline/inventory-value";
import { useDebounce, useLocalStorage, usePagination, useClientPagedRows } from "@/hooks/use-ui";
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
import { useInventoryList, useBranchesList } from "@/hooks/use-offline-lists";
import { StockStatusBadges } from "@/features/inventory/components/stock-status-badges";
import { expiryAlertQuantity, formatExpiryDate, lotStatus } from "@/lib/expiry";
import { signedStockDelta } from "@/lib/quantity";
import {
  ADD_STOCK_SELECT,
  REMOVE_STOCK_SELECT,
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
import {
  clampListPageSize,
  DEFAULT_LIST_PAGE_SIZE,
  type ListPageSize,
} from "@/constants/list-page";
import { replaceClientShellUrl } from "@/lib/navigation/client-shell-url";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { findLocalProductsByBarcode } from "@/lib/offline/snapshot";
import { listMirroredLots } from "@/lib/offline/mirror-queries";
import { getOfflineDb } from "@/lib/offline/db";
import { listCachedProductPickerRows } from "@/lib/offline/product-list-cache";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { isBarcodeScanningEnabled } from "@/services/hardware";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueAdjustStock,
  queueTransferStock,
} from "@/lib/offline/replica-writes";
import type { MirroredLot } from "@/lib/offline/types";

function InventoryViewInner() {
  const {
    isAdmin,
    canManageProducts,
    canViewCost,
    branchId: myBranchId,
    branchName,
  } = usePermissions();
  // Millie's is one store — no branch transfers or wholesale warehouse.
  const canTransferStock = false;
  const showWholesale = false;
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
  const [immediateSearch, setImmediateSearch] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 250);
  const listSearch = immediateSearch ?? debouncedSearch;
  const alertMode = lowOnly || expiryOnly;
  const [storedPageSize, setStoredPageSize] = useLocalStorage<number>(
    "novend.listPageSize",
    DEFAULT_LIST_PAGE_SIZE,
  );
  const pageSize = clampListPageSize(storedPageSize);
  const { page, setPage, reset } = usePagination(1, pageSize);
  useEffect(() => {
    if (immediateSearch != null && debouncedSearch === immediateSearch) {
      setImmediateSearch(null);
    }
  }, [debouncedSearch, immediateSearch]);
  /** Admin override; default `all` = organization-wide stock totals. */
  const [branchOverride, setBranchOverride] = useState<Id<"branches"> | "all">(() =>
    branchParam && branchParam !== "all" ? (branchParam as Id<"branches">) : "all",
  );
  useEffect(() => {
    reset();
  }, [listSearch, branchOverride, lowOnly, expiryOnly, reset]);
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
  const [lotId, setLotId] = useState("");
  const [localLots, setLocalLots] = useState<MirroredLot[]>([]);

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
      void getOfflineDb().then((db) => {
        if (!db || cancelled) return;
        void listCachedProductPickerRows(db, {
          branchId: fromBranchId,
          includeInactive: false,
        }).then((rows) => {
          if (cancelled) return;
          setTransferSourceRows(rows);
        });
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
    const href = qs ? `${pathname}?${qs}` : pathname;
    if (replaceClientShellUrl(href)) return;
    router.replace(href, { scroll: false });
  }

  const branches = useBranchesList(false);
  const transferBranches = branches;

  const branchFilter = isAdmin ? branchOverride : myBranchId;

  const listBranchId: Id<"branches"> | undefined = isAdmin
    ? branchOverride !== "all"
      ? branchOverride
      : undefined
    : undefined;

  /** Cloud KPIs when online; Millie's / offline uses Dexie valuation below. */
  const remoteValuation = useAuthedQuery(
    api.inventory.valuationSummary,
    !FULLY_OFFLINE && online && canViewCost ? { branchId: listBranchId } : "skip",
  );
  const [localValuation, setLocalValuation] = useState<OfflineInventoryValuation | null>(null);
  useEffect(() => {
    if (!canViewCost || (!FULLY_OFFLINE && online)) {
      queueMicrotask(() => setLocalValuation(null));
      return;
    }
    let cancelled = false;
    const load = () => {
      void loadOfflineInventoryValuation({
        branchId: listBranchId ? String(listBranchId) : null,
        showCost: canViewCost,
      }).then((data) => {
        if (!cancelled) setLocalValuation(data);
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [canViewCost, listBranchId, online]);
  const valuation = FULLY_OFFLINE || !online ? localValuation : remoteValuation;

  const {
    rows,
    total: listTotal,
    loading: listLoading,
  } = useInventoryList({
    search: listSearch,
    branchId: listBranchId,
    page: alertMode ? undefined : page,
    pageSize: alertMode ? undefined : pageSize,
    stockAlert: lowOnly ? "low" : expiryOnly ? "expiry" : undefined,
  });

  const transferProductOptions = useMemo(() => {
    const source = transferSourceRows.length > 0 ? transferSourceRows : (rows ?? []);
    return source.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.stockQuantity})`,
      keywords: p.sku,
    }));
  }, [transferSourceRows, rows]);

  const history = useAuthedQuery(
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

    return rows;
  }, [rows, lowOnly, expiryOnly, isAdmin, branchOverride]);

  const alertPaging = useClientPagedRows(
    alertMode ? visibleRows : undefined,
    `${listSearch}|${String(listBranchId)}|${lowOnly}|${expiryOnly}`,
  );

  const pageRows = alertMode ? alertPaging.paged : rows;
  const total = alertMode ? alertPaging.total : listTotal;
  const displayPage = alertMode ? alertPaging.page : page;
  const setDisplayPage = alertMode ? alertPaging.setPage : setPage;
  const setDisplayPageSize = (size: ListPageSize) => {
    setStoredPageSize(size);
    if (alertMode) {
      alertPaging.setPageSize(size);
    } else {
      reset();
    }
  };

  const selected = useMemo(
    () =>
      visibleRows?.find((row) => row.id === adjustId) ??
      pageRows?.find((row) => row.id === adjustId) ??
      null,
    [visibleRows, pageRows, adjustId],
  );

  const adjustLotsBranchId = listBranchId ?? (adjustBranchId || null);

  const remoteLots = useAuthedQuery(
    api.inventory.listLots,
    online && adjustId && selected?.tracksExpiry && direction === "remove"
      ? {
          productId: adjustId,
          branchId: (adjustLotsBranchId || undefined) as Id<"branches"> | undefined,
        }
      : "skip",
  );

  useEffect(() => {
    if (!adjustId || !selected?.tracksExpiry || direction !== "remove") {
      queueMicrotask(() => setLocalLots([]));
      return;
    }
    let cancelled = false;
    const load = () => {
      void listMirroredLots(adjustId, adjustLotsBranchId).then((rows) => {
        if (!cancelled) setLocalLots(rows);
      });
    };
    load();
    return subscribeReplicaChanged(load);
  }, [adjustId, selected?.tracksExpiry, direction, adjustLotsBranchId]);

  const removeLotOptions = useMemo(() => {
    if (online && remoteLots) {
      return remoteLots.map((lot) => ({
        id: lot.id,
        expiryDate: lot.expiryDate,
        quantity: lot.quantity,
        status: lot.status as "expired" | "expiring" | "ok",
        label: `${formatExpiryDate(lot.expiryDate)} · ${lot.quantity} units${
          lot.status === "expired" ? " · Expired" : lot.status === "expiring" ? " · Expiring" : ""
        }`,
      }));
    }
    const alertDays = 30;
    return localLots.map((lot) => {
      const status = lotStatus(lot.expiryDate, alertDays);
      return {
        id: lot.id,
        expiryDate: lot.expiryDate,
        quantity: lot.quantity,
        status,
        label: `${formatExpiryDate(lot.expiryDate)} · ${lot.quantity} units${
          status === "expired" ? " · Expired" : status === "expiring" ? " · Expiring" : ""
        }`,
      };
    });
  }, [online, remoteLots, localLots]);

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
    if (selected?.tracksExpiry && quantityChange < 0) {
      if (!lotId) {
        toast.error("Select which expiry lot to remove from");
        return;
      }
      const lot = removeLotOptions.find((row) => row.id === lotId);
      if (lot && Math.abs(quantityChange) > lot.quantity) {
        toast.error(`That lot only has ${lot.quantity} units`);
        return;
      }
    }
    if (selected?.tracksExpiry && quantityChange > 0 && !expiryDate.trim()) {
      toast.error("Enter an expiry date for the stock you are adding");
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
            expiryDate: quantityChange > 0 ? expiryDate || undefined : undefined,
            lotId:
              quantityChange < 0 && lotId
                ? (lotId as Id<"inventoryLots">)
                : undefined,
          }),
        local: () =>
          queueAdjustStock({
            productId: adjustId,
            branchId,
            quantityChange,
            reason,
            note: note || undefined,
            expiryDate: quantityChange > 0 ? expiryDate || undefined : undefined,
            lotId: quantityChange < 0 ? lotId || undefined : undefined,
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
      setLotId("");
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
    setLotId("");
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
            ...(showWholesale
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
            {showWholesale ? (
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

      {canViewCost ? (
        <div className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Inventory &amp; profit
          </h2>
          {valuation ? (
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
          ) : (
            <LoadingState label="Loading inventory value…" />
          )}
        </div>
      ) : null}

      <div data-tour="inventory-filters">
        {isAdmin ? (
          <CollapsibleFilters
            leading={
              <BarcodeSearchField
                value={search}
                onChange={(value) => {
                  setImmediateSearch(null);
                  setSearch(value);
                }}
                onScan={(code) => {
                  setSearch(code);
                  setImmediateSearch(code);
                }}
                placeholder="Search inventory or scan barcode…"
                listenHid={!adjustId && !transferOpen}
              />
            }
            defaultOpen={stockFilter !== "all"}
            activeCount={
              (branchOverride !== "all" ? 1 : 0) + (stockFilter !== "all" ? 1 : 0)
            }
            onReset={() => {
              setBranchOverride("all");
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
          </CollapsibleFilters>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 w-full flex-1 sm:max-w-md">
              <BarcodeSearchField
                value={search}
                onChange={(value) => {
                  setImmediateSearch(null);
                  setSearch(value);
                }}
                onScan={(code) => {
                  setSearch(code);
                  setImmediateSearch(code);
                }}
                placeholder="Search inventory or scan barcode…"
                listenHid={!adjustId && !transferOpen}
              />
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-end justify-end gap-2 sm:w-auto">
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
              {branchName ? (
                <BranchFilter
                  branches={branches}
                  value={myBranchId}
                  onChange={() => undefined}
                  lockedLabel={branchName}
                  className="w-full sm:w-auto"
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

      <Card data-tour="inventory-summary">
        <CardContent className="overflow-x-auto p-0">
          {visibleRows === undefined || (listLoading && !rows) ? (
            <div className="p-6">
              <LoadingState label="Loading inventory…" />
            </div>
          ) : (alertMode ? visibleRows.length === 0 : total === 0) ? (
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
                            <div className="bg-muted relative h-9 w-9 shrink-0 overflow-hidden rounded-md">
                              <ProductImage
                                productId={row.id}
                                remoteUrl={row.imageUrl}
                                alt={row.name}
                                sizes="36px"
                                fallback={
                                  <Package className="text-muted-foreground absolute inset-0 m-auto h-4 w-4" />
                                }
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
                  page={displayPage}
                  pageSize={alertMode ? alertPaging.pageSize : pageSize}
                  total={total}
                  onPageChange={setDisplayPage}
                  onPageSizeChange={setDisplayPageSize}
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
                  setLotId("");
                  if (next === "remove") setExpiryDate("");
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
            {selected?.tracksExpiry && direction === "remove" ? (
              <div className="space-y-2">
                <Label>Expiry lot</Label>
                {removeLotOptions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No active expiry lots with stock for this branch.
                  </p>
                ) : (
                  <Select value={lotId || undefined} onValueChange={setLotId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose expiry date / batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {removeLotOptions.map((lot) => (
                        <SelectItem key={lot.id} value={lot.id}>
                          {lot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-muted-foreground text-xs">
                  Select the exact expired or dated lot to write off. FEFO is only used when no lot
                  is chosen.
                </p>
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
                  {(direction === "add" ? ADD_STOCK_SELECT : REMOVE_STOCK_SELECT).map((option) => (
                    <SelectItem key={`${direction}-${option.value}-${option.label}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
