"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { BranchFilter } from "@/components/filters/branch-filter";
import { formatCurrency, roundMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { Minus, Package, Plus, ScanBarcode, ShoppingCart, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { printReceipt, loadTerminalPrinterConfig, probePrintBridge } from "@/services/printing";
import type { ReceiptPayload } from "@/features/receipts/types";
import { ReceiptPreviewDialog } from "@/features/receipts/components/receipt-preview-dialog";
import { SaleCompletedDialog } from "@/features/receipts/components/sale-completed-dialog";
import { isCapacitor } from "@novend/hardware";
import { useSalesCatalog, useSalesCustomerSearch } from "@/hooks/use-offline-catalog";
import { useBranchesList } from "@/hooks/use-offline-lists";
import { usePosPreferences } from "@/hooks/use-pos-preferences";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useOfflineStatus } from "@/providers/offline-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { useNativeShell } from "@/hooks/use-native-shell";
import { getMeta, getOfflineDb, META_KEYS, newClientId } from "@/lib/offline/db";
import { cn } from "@/lib/utils";
import {
  completeSaleLocally,
  holdSaleLocally,
  listLocalHeldSales,
  mirrorCompletedSale,
  resumeLocalHeldSale,
} from "@/lib/offline/sales-repository";
import { findLocalProductsByBarcode } from "@/lib/offline/snapshot";
import { resolveReceiptPrintMode } from "@/lib/receipt-print-mode";
import type { LocalHeldSale } from "@/lib/offline/types";
import { ProductImage } from "@/components/media/product-image";
import {
  isBarcodeScanningEnabled,
  playScanSuccessBeep,
  shouldShowCameraBarcodeButton,
} from "@/services/hardware";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import {
  BarcodeMatchDialog,
  type BarcodeMatchProduct,
} from "@/features/sales/components/barcode-match-dialog";
import { DraggableCartFab } from "@/features/sales/components/draggable-cart-fab";
import {
  readCartDraft,
  writeCartDraft,
  type CartDraftItem,
} from "@/lib/sales/cart-draft";

type DiscountMode = "amount" | "percent";

type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
};

type SelectedCustomer = {
  id: string;
  name: string;
  phone: string | null;
} | null;

type HeldRow = {
  key: string;
  source: "local" | "remote";
  localId?: string;
  remoteId?: Id<"heldSales">;
  label: string;
  total: number;
  heldAt: number;
  holdRef: string;
};

function formatHoldRef(id: string) {
  const normalized = id.replace(/^lhold_/, "");
  return normalized.slice(-6).toUpperCase() || id.slice(-6).toUpperCase();
}

export function SalesView() {
  const { isAdmin, branchId: myBranchId, branchName } = usePermissions();
  const nativeShell = useNativeShell();
  const [search, setSearch] = useState("");
  const [branchOverride, setBranchOverride] = useState<Id<"branches"> | "all" | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<SelectedCustomer>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("amount");
  const [discountField, setDiscountField] = useState(0);
  const [lastReceipt, setLastReceipt] = useState<ReceiptPayload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saleCompleteOpen, setSaleCompleteOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [localHeld, setLocalHeld] = useState<LocalHeldSale[]>([]);
  const [cashierId, setCashierId] = useState<string | null>(null);
  /** Draft qty strings while editing — empty allowed until blur. */
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [barcodeMatches, setBarcodeMatches] = useState<{
    code: string;
    products: BarcodeMatchProduct[];
  } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const showCameraScan = shouldShowCameraBarcodeButton();
  const [hydratedCartScope, setHydratedCartScope] = useState<string | null>(null);

  const mirroredBranches = useBranchesList();
  const branches = isAdmin ? mirroredBranches : undefined;
  const workingBranchId = isAdmin
    ? branchOverride && branchOverride !== "all"
      ? branchOverride
      : (myBranchId ?? branches?.[0]?.id ?? null)
    : myBranchId;

  const { online, dexieAvailable } = useOfflineStatus();
  const {
    products: catalog,
    loading: catalogLoading,
    refreshLocal,
  } = useSalesCatalog(search, workingBranchId ?? myBranchId ?? undefined);
  const customerHits = useSalesCustomerSearch(customerQuery);
  const remoteHeld = useQuery(api.sales.listHeld, online ? {} : "skip");
  const holdSale = useMutation(api.sales.holdSale);
  const resumeHeld = useMutation(api.sales.resumeHeld);
  const completeSaleRemote = useMutation(api.sales.completeSale);
  const createCustomer = useMutation(api.customers.create);
  const posPrefs = usePosPreferences();

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0),
    [cart],
  );
  const cartDiscount = useMemo(() => {
    if (discountMode === "percent") {
      return roundMoney(subtotal * (Math.max(0, discountField) / 100));
    }
    return roundMoney(Math.max(0, discountField));
  }, [discountMode, discountField, subtotal]);
  const discountExceedsSubtotal =
    discountMode === "percent" ? discountField - 100 > 0.001 : cartDiscount - subtotal > 0.001;
  const total = discountExceedsSubtotal ? 0 : Math.max(0, subtotal - cartDiscount);
  const canCheckout = cart.length > 0 && !discountExceedsSubtotal;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function setDiscountModeAndConvert(next: DiscountMode) {
    if (next === discountMode) return;
    if (next === "percent") {
      const pct = subtotal > 0 ? roundMoney((cartDiscount / subtotal) * 100) : 0;
      setDiscountField(pct);
    } else {
      setDiscountField(cartDiscount);
    }
    setDiscountMode(next);
  }

  function clearCartDiscount() {
    setDiscountField(0);
    setDiscountMode("amount");
  }

  useEffect(() => {
    void (async () => {
      const db = await getOfflineDb();
      if (!db) return;
      const uid = await getMeta(db, META_KEYS.profileUserId);
      setCashierId(uid);
      setLocalHeld(await listLocalHeldSales(uid ?? undefined));
    })();
  }, []);

  useEffect(() => {
    if (!cashierId || !workingBranchId) return;
    const draft = readCartDraft(cashierId, workingBranchId);
    setCart((draft?.items as CartItem[] | undefined) ?? []);
    setDiscountMode(draft?.discountMode ?? "amount");
    setDiscountField(draft?.discountField ?? 0);
    setCustomer(draft?.customer ?? null);
    setQtyDrafts({});
    setHydratedCartScope(`${cashierId}:${workingBranchId}`);
  }, [cashierId, workingBranchId]);

  useEffect(() => {
    if (!cashierId || !workingBranchId) return;
    if (hydratedCartScope !== `${cashierId}:${workingBranchId}`) return;
    writeCartDraft({
      userId: cashierId,
      branchId: workingBranchId,
      items: cart satisfies CartDraftItem[],
      discountMode,
      discountField,
      customer,
      savedAt: Date.now(),
    });
  }, [
    cart,
    discountMode,
    discountField,
    customer,
    cashierId,
    workingBranchId,
    hydratedCartScope,
  ]);

  async function refreshLocalHeld() {
    const rows = await listLocalHeldSales(cashierId ?? undefined);
    setLocalHeld(rows);
  }

  const heldRows: HeldRow[] = useMemo(() => {
    const localRows: HeldRow[] = localHeld.map((sale) => ({
      key: `local-${sale.id}`,
      source: "local",
      localId: sale.id,
      label: sale.label || sale.customerName || "Held cart",
      total: sale.total,
      heldAt: sale.heldAt,
      holdRef: formatHoldRef(sale.id),
    }));
    const remoteRows: HeldRow[] =
      remoteHeld?.map((sale) => ({
        key: `remote-${sale._id}`,
        source: "remote",
        remoteId: sale._id,
        label: sale.label || sale.customerName || "Held cart",
        total: sale.total,
        heldAt: sale.heldAt,
        holdRef: formatHoldRef(String(sale._id)),
      })) ?? [];
    return [...localRows, ...remoteRows].sort((a, b) => b.heldAt - a.heldAt);
  }, [localHeld, remoteHeld]);

  function addToCart(product: {
    id: string;
    name: string;
    sellingPrice: number;
    stockQuantity: number;
    isExpiring?: boolean;
  }) {
    if (product.stockQuantity < 1) {
      toast.error(`Not enough stock for ${product.name}`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stockQuantity) {
          toast.error(`Not enough stock for ${product.name}. Available: ${product.stockQuantity}.`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.sellingPrice,
          quantity: 1,
          discount: 0,
        },
      ];
    });
  }

  function addScannedProduct(product: {
    id: string;
    name: string;
    sellingPrice: number;
    stockQuantity: number;
  }) {
    if (product.stockQuantity <= 0) {
      toast.error(`Not enough stock for ${product.name}`);
      return;
    }
    addToCart(product);
    playScanSuccessBeep();
    toast.success(`Added ${product.name}`);
  }

  function handleBarcodeScan(code: string) {
    void (async () => {
      const localMatches = await findLocalProductsByBarcode(
        code,
        workingBranchId ?? myBranchId ?? undefined,
      );
      const catalogMatches = catalog.filter(
        (p) =>
          p.sku.toLowerCase() === code.trim().toLowerCase() ||
          (p.barcode?.trim().toLowerCase() ?? "") === code.trim().toLowerCase(),
      );
      const byId = new Map<string, BarcodeMatchProduct>();
      for (const product of [...localMatches, ...catalogMatches]) {
        byId.set(product.id, {
          id: product.id,
          name: product.name,
          sku: product.sku,
          sellingPrice: product.sellingPrice,
          stockQuantity: product.stockQuantity,
          imageUrl: product.imageUrl,
        });
      }
      const matches = [...byId.values()];
      if (matches.length === 0) {
        toast.error("Product not found");
        return;
      }
      if (matches.length === 1) {
        addScannedProduct(matches[0]!);
        return;
      }
      setBarcodeMatches({ code, products: matches });
    })();
  }

  useBarcodeScanner(handleBarcodeScan, {
    enabled: isBarcodeScanningEnabled(),
    allowInInputs: true,
  });

  function setCartQuantity(productId: string, raw: string) {
    setQtyDrafts((prev) => ({ ...prev, [productId]: raw }));
  }

  function commitCartQuantity(productId: string) {
    const draft = qtyDrafts[productId];
    const stock =
      catalog.find((p) => p.id === productId)?.stockQuantity ?? Number.POSITIVE_INFINITY;
    const current = cart.find((row) => row.productId === productId)?.quantity ?? 1;

    if (draft === undefined) return;

    const trimmed = draft.trim();
    if (trimmed === "") {
      setQtyDrafts((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error("Enter a quantity of at least 1");
      setQtyDrafts((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setCart((prev) =>
        prev.map((row) => (row.productId === productId ? { ...row, quantity: current } : row)),
      );
      return;
    }

    const quantity = Math.min(parsed, stock);
    if (parsed > stock) {
      toast.error(`Not enough stock. Available: ${stock}.`);
    }
    setCart((prev) =>
      prev.map((row) => (row.productId === productId ? { ...row, quantity } : row)),
    );
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function changeBranch(next: Id<"branches"> | "all") {
    if (next === "all") return;
    setBranchOverride(next);
  }

  async function onHold() {
    if (!canCheckout) return;
    try {
      if (!online) {
        const db = await getOfflineDb();
        if (!db) throw new Error("Cannot hold sale without local storage while offline");
        const uid = cashierId ?? (await getMeta(db, META_KEYS.profileUserId)) ?? "local";
        await holdSaleLocally({
          cashierId: uid,
          customerId: customer?.id,
          customerName: customer?.name,
          items: cart,
          discount: cartDiscount,
        });
        setCart([]);
        clearCartDiscount();
        setCheckoutOpen(false);
        await refreshLocalHeld();
        toast.success("Sale held on this device");
        return;
      }

      await holdSale({
        customerId: customer?.id as Id<"customers"> | undefined,
        customerName: customer?.name,
        items: cart.map((item) => ({
          productId: item.productId as Id<"products">,
          quantity: item.quantity,
          discount: item.discount,
        })),
        discount: cartDiscount,
        branchId: (isAdmin ? workingBranchId : myBranchId) ?? undefined,
      });
      setCart([]);
      clearCartDiscount();
      setCheckoutOpen(false);
      toast.success("Sale held");
    } catch (error) {
      showError(error, "Hold failed");
    }
  }

  async function triggerPrint(payload: ReceiptPayload) {
    setLastReceipt(payload);
    const printMode = resolveReceiptPrintMode(posPrefs);
    if (isCapacitor()) {
      if (printMode === "automatic") {
        const result = await printReceipt(payload);
        if (result.printed) {
          toast.success(
            result.reason === "native" ? "Receipt sent to printer" : "Print dialog opened",
          );
        } else {
          toast.error(
            "Could not print. Pair a Bluetooth printer in Settings, or use Share / Save PDF.",
          );
        }
      }
      setSaleCompleteOpen(true);
      return;
    }
    if (printMode === "never") {
      return;
    }
    if (printMode === "manual") {
      setPreviewOpen(true);
      return;
    }
    const config = loadTerminalPrinterConfig();
    if (config.preferNative) {
      const status = await probePrintBridge();
      if (status.ok) {
        const result = await printReceipt(payload);
        if (result.printed && result.reason === "native") {
          toast.success("Receipt sent to printer");
          return;
        }
      }
    }
    setPreviewOpen(true);
  }

  function openLastReceipt() {
    if (!lastReceipt) return;
    if (isCapacitor()) {
      setSaleCompleteOpen(true);
      return;
    }
    setPreviewOpen(true);
  }

  async function onPay() {
    if (!canCheckout) return;
    const saleBranchId = (isAdmin ? workingBranchId : myBranchId) ?? undefined;
    if (!saleBranchId) {
      toast.error("Select a branch before completing this sale");
      return;
    }
    const oversold = cart.find((item) => {
      const available = catalog.find((p) => p.id === item.productId)?.stockQuantity ?? 0;
      return item.quantity > available;
    });
    if (oversold) {
      const available = catalog.find((p) => p.id === oversold.productId)?.stockQuantity ?? 0;
      toast.error(`Not enough stock for ${oversold.name}. Available: ${available}.`);
      return;
    }
    const saleInput = {
      customerId: customer?.id as Id<"customers"> | undefined,
      customerName: customer?.name,
      items: cart.map((item) => ({
        productId: item.productId as Id<"products">,
        quantity: item.quantity,
        discount: item.discount,
      })),
      discount: cartDiscount,
      paymentMethod: "cash" as const,
      branchId: saleBranchId,
    };
    try {
      if (online) {
        const result = await completeSaleRemote({
          ...saleInput,
          clientOperationId: newClientId("sale"),
        });
        const receipt = result.receiptPayload as ReceiptPayload;
        await mirrorCompletedSale({
          saleId: String(result.saleId),
          invoiceNumber: result.invoiceNumber,
          customerId: customer?.id,
          customerName: customer?.name ?? receipt.customerName ?? "Walk-in Customer",
          itemCount: receipt.itemCount ?? cartItemCount,
          subtotal: receipt.subtotal ?? subtotal,
          discount: receipt.discount ?? cartDiscount,
          total: result.total,
          paymentMethod: "cash",
          completedAt: receipt.completedAt ?? Date.now(),
          branchId: saleBranchId,
          items: cart.map((item) => ({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: roundMoney(item.unitPrice * item.quantity - item.discount),
          })),
        });
        setCart([]);
        clearCartDiscount();
        setCustomer(null);
        setCustomerQuery("");
        setCheckoutOpen(false);
        await refreshLocal();
        toast.success(`Sale complete · ${result.invoiceNumber}`, { id: "sale-complete" });
        await triggerPrint(result.receiptPayload as ReceiptPayload);
        return;
      }
      if (isAdmin && myBranchId && saleBranchId !== myBranchId) {
        toast.error("Connect to the internet to sell from another branch.");
        return;
      }
      if (!dexieAvailable) {
        toast.error("Local storage unavailable — cannot complete sale offline");
        return;
      }
      const result = await completeSaleLocally({
        items: cart,
        discount: cartDiscount,
        paymentMethod: "cash",
        customerId: customer?.id,
        customerName: customer?.name,
        customerPhone: customer?.phone,
        branchId: saleBranchId,
      });
      setCart([]);
      clearCartDiscount();
      setCustomer(null);
      setCustomerQuery("");
      setCheckoutOpen(false);
      await refreshLocal();
      toast.success(`Sale saved · ${result.invoiceNumber}`, { id: "sale-complete" });
      await triggerPrint(result.receiptPayload);
    } catch (error) {
      showError(error, "Payment failed");
    }
  }

  async function onResume(row: HeldRow) {
    try {
      if (row.source === "local" && row.localId) {
        const heldSale = await resumeLocalHeldSale(row.localId);
        setCart(
          heldSale.items.map((item) => ({
            productId: item.productId,
            name: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            discount: item.discount,
          })),
        );
        setDiscountMode("amount");
        setDiscountField(heldSale.discount);
        if (heldSale.customerId) {
          setCustomer({
            id: heldSale.customerId,
            name: heldSale.customerName ?? "Customer",
            phone: null,
          });
        } else {
          setCustomer(null);
        }
        await refreshLocalHeld();
        toast.success("Held sale resumed");
        return;
      }

      if (!row.remoteId) return;
      const heldSale = await resumeHeld({ id: row.remoteId });
      setCart(
        heldSale.items.map((item) => ({
          productId: item.productId,
          name: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discount: item.discount,
        })),
      );
      setDiscountMode("amount");
      setDiscountField(heldSale.discount);
      if (heldSale.customerId) {
        setCustomer({
          id: heldSale.customerId,
          name: heldSale.customerName ?? "Customer",
          phone: null,
        });
      } else {
        setCustomer(null);
      }
      toast.success("Held sale resumed");
    } catch (error) {
      showError(error, "Resume failed");
    }
  }

  async function onQuickCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!online) {
      toast.error("Creating customers requires an internet connection");
      return;
    }
    try {
      const id = await createCustomer({
        name: quickName,
        phone: quickPhone || undefined,
      });
      setCustomer({ id, name: quickName.trim(), phone: quickPhone || null });
      setQuickOpen(false);
      setQuickName("");
      setQuickPhone("");
      setCustomerQuery("");
      toast.success("Customer added to sale");
    } catch (error) {
      showError(error, "Could not create customer");
    }
  }

  return (
    <div
      className={cn(
        "space-y-6 xl:pb-0",
        nativeShell ? "pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]" : "pb-24",
      )}
    >
      <PageHeader title="Sales" description="Create a new wholesale or retail sale." />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex max-w-lg flex-1 gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="min-h-12 min-w-0 flex-1 md:min-h-9"
              />
              {showCameraScan ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 shrink-0 md:size-9"
                  aria-label="Scan barcode"
                  onClick={() => setCameraOpen(true)}
                >
                  <ScanBarcode className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            {isAdmin ? (
              <BranchFilter
                branches={branches}
                value={workingBranchId}
                onChange={changeBranch}
                allowAll={false}
                label="Selling from"
              />
            ) : branchName ? (
              <BranchFilter
                branches={undefined}
                value={myBranchId}
                onChange={() => undefined}
                lockedLabel={branchName}
                label="Branch"
              />
            ) : null}
          </div>
          <h2 className="text-sm font-semibold tracking-tight">Quick Products</h2>
          {catalogLoading ? (
            <LoadingState label="Loading products…" />
          ) : catalog.length === 0 ? (
            <EmptyState icon={Package} title="No products available" />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {catalog.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="border-border hover:border-primary bg-card rounded-xl border p-2 text-left shadow-sm transition sm:p-3"
                >
                  <div className="bg-muted relative mb-2 aspect-square overflow-hidden rounded-lg sm:mb-3 sm:aspect-[4/3]">
                    <ProductImage
                      productId={product.id}
                      remoteUrl={product.imageUrl}
                      alt={product.name}
                      sizes="(max-width: 640px) 50vw, 240px"
                      fallback={
                        <Package className="text-muted-foreground absolute inset-0 m-auto h-7 w-7 sm:h-8 sm:w-8" />
                      }
                    />
                  </div>
                  <p className="line-clamp-2 text-sm leading-tight font-medium">{product.name}</p>
                  <p className="text-primary mt-1 text-sm font-semibold">
                    {formatCurrency(product.sellingPrice)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    Stock {product.stockQuantity} {product.unit}
                  </p>
                  {product.isExpiring ? (
                    <Badge variant="warning" className="mt-1 sm:mt-2">
                      Expiring soon
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {heldRows.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Held sales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {heldRows.map((sale) => (
                  <div key={sale.key} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {sale.label}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · #{sale.holdRef}
                        </span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(sale.heldAt)} · {formatCurrency(sale.total)}
                        {sale.source === "local" ? " · This device" : null}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void onResume(sale)}
                    >
                      Resume
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="hidden h-fit self-start xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-5.5rem)] xl:overflow-y-auto">
          <CardHeader className="bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10 backdrop-blur">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Current Sale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SalesCheckoutFields
              online={online}
              customer={customer}
              customerQuery={customerQuery}
              customerHits={customerHits}
              cart={cart}
              catalog={catalog}
              qtyDrafts={qtyDrafts}
              subtotal={subtotal}
              cartDiscount={cartDiscount}
              total={total}
              discountMode={discountMode}
              discountField={discountField}
              discountExceedsSubtotal={discountExceedsSubtotal}
              canCheckout={canCheckout}
              lastReceipt={lastReceipt}
              onQuickCreate={() => setQuickOpen(true)}
              onClearCustomer={() => setCustomer(null)}
              onCustomerQuery={setCustomerQuery}
              onSelectCustomer={(hit) => {
                setCustomer(hit);
                setCustomerQuery("");
              }}
              onSetCart={setCart}
              onSetCartQuantity={setCartQuantity}
              onCommitCartQuantity={commitCartQuantity}
              onDiscountMode={setDiscountModeAndConvert}
              onDiscountField={setDiscountField}
              onHold={() => void onHold()}
              onPay={() => void onPay()}
              onReprint={openLastReceipt}
            />
          </CardContent>
        </Card>
      </div>

      <div className="xl:hidden">
        <DraggableCartFab
          itemCount={cartItemCount}
          totalLabel={formatCurrency(total)}
          bottomInsetPx={nativeShell ? 92 : 24}
          onOpen={() => setCheckoutOpen(true)}
        />
      </div>

      <Drawer open={checkoutOpen} onOpenChange={setCheckoutOpen} shouldScaleBackground={false}>
        <DrawerContent
          className="flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)))] max-h-[92dvh] flex-col rounded-t-[22px] xl:hidden"
          overlayClassName="bg-black/60"
        >
          <DrawerHeader className="border-border shrink-0 border-b text-left">
            <DrawerTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Current Sale
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 pt-2">
            <SalesCheckoutFields
              online={online}
              customer={customer}
              customerQuery={customerQuery}
              customerHits={customerHits}
              cart={cart}
              catalog={catalog}
              qtyDrafts={qtyDrafts}
              subtotal={subtotal}
              cartDiscount={cartDiscount}
              total={total}
              discountMode={discountMode}
              discountField={discountField}
              discountExceedsSubtotal={discountExceedsSubtotal}
              canCheckout={canCheckout}
              lastReceipt={lastReceipt}
              pinActions
              onQuickCreate={() => setQuickOpen(true)}
              onClearCustomer={() => setCustomer(null)}
              onCustomerQuery={setCustomerQuery}
              onSelectCustomer={(hit) => {
                setCustomer(hit);
                setCustomerQuery("");
              }}
              onSetCart={setCart}
              onSetCartQuantity={setCartQuantity}
              onCommitCartQuantity={commitCartQuantity}
              onDiscountMode={setDiscountModeAndConvert}
              onDiscountField={setDiscountField}
              onHold={() => void onHold()}
              onPay={() => void onPay()}
              onReprint={openLastReceipt}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <ReceiptPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        payload={lastReceipt}
      />
      <SaleCompletedDialog
        open={saleCompleteOpen}
        onOpenChange={setSaleCompleteOpen}
        payload={lastReceipt}
        printMode={resolveReceiptPrintMode(posPrefs)}
      />

      <BarcodeMatchDialog
        open={barcodeMatches != null}
        code={barcodeMatches?.code ?? ""}
        products={barcodeMatches?.products ?? []}
        onOpenChange={(open) => {
          if (!open) setBarcodeMatches(null);
        }}
        onSelect={(product) => {
          setBarcodeMatches(null);
          addScannedProduct(product);
        }}
      />
      <ScanBarcodeCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetect={handleBarcodeScan}
      />

      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick create customer</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onQuickCreate}>
            <div className="space-y-2">
              <Label htmlFor="quick-name">Name</Label>
              <Input
                id="quick-name"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-phone">Phone (optional)</Label>
              <Input
                id="quick-phone"
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setQuickOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!online}>
                Add to sale
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type CheckoutCustomerHit = {
  id: string;
  name: string;
  phone: string | null;
};

type SalesCheckoutFieldsProps = {
  online: boolean;
  customer: SelectedCustomer;
  customerQuery: string;
  customerHits: CheckoutCustomerHit[];
  cart: CartItem[];
  catalog: Array<{ id: string; stockQuantity: number }>;
  qtyDrafts: Record<string, string>;
  subtotal: number;
  cartDiscount: number;
  total: number;
  discountMode: DiscountMode;
  discountField: number;
  discountExceedsSubtotal: boolean;
  canCheckout: boolean;
  lastReceipt: ReceiptPayload | null;
  /** Pin Hold/Pay to the bottom of a full-height sheet (mobile checkout drawer). */
  pinActions?: boolean;
  onQuickCreate: () => void;
  onClearCustomer: () => void;
  onCustomerQuery: (value: string) => void;
  onSelectCustomer: (hit: CheckoutCustomerHit) => void;
  onSetCart: Dispatch<SetStateAction<CartItem[]>>;
  onSetCartQuantity: (productId: string, raw: string) => void;
  onCommitCartQuantity: (productId: string) => void;
  onDiscountMode: (mode: DiscountMode) => void;
  onDiscountField: (value: number) => void;
  onHold: () => void;
  onPay: () => void;
  onReprint: () => void;
};

function SalesCheckoutFields({
  online,
  customer,
  customerQuery,
  customerHits,
  cart,
  catalog,
  qtyDrafts,
  subtotal,
  cartDiscount,
  total,
  discountMode,
  discountField,
  discountExceedsSubtotal,
  canCheckout,
  lastReceipt,
  pinActions = false,
  onQuickCreate,
  onClearCustomer,
  onCustomerQuery,
  onSelectCustomer,
  onSetCart,
  onSetCartQuantity,
  onCommitCartQuantity,
  onDiscountMode,
  onDiscountField,
  onHold,
  onPay,
  onReprint,
}: SalesCheckoutFieldsProps) {
  const actions = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" disabled={!canCheckout} onClick={onHold}>
          Hold
        </Button>
        <Button type="button" disabled={!canCheckout} onClick={onPay}>
          Pay
        </Button>
      </div>
      {lastReceipt ? (
        <Button type="button" variant="outline" className="w-full" onClick={onReprint}>
          Reprint last receipt
        </Button>
      ) : null}
    </div>
  );

  const body = (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" />
            Customer
          </Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!online}
            title={!online ? "Requires internet" : undefined}
            onClick={onQuickCreate}
          >
            Quick create
          </Button>
        </div>
        {customer ? (
          <div className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{customer.name}</p>
              {customer.phone ? (
                <p className="text-muted-foreground text-xs">{customer.phone}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onClearCustomer}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Clear to Walk-in</span>
            </Button>
          </div>
        ) : (
          <div className="relative space-y-1">
            <Input
              value={customerQuery}
              onChange={(e) => onCustomerQuery(e.target.value)}
              placeholder="Walk-in · search to attach…"
            />
            {customerHits.length > 0 ? (
              <div className="border-border bg-card absolute z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-md">
                {customerHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                    onClick={() => onSelectCustomer(hit)}
                  >
                    <span className="font-medium">{hit.name}</span>
                    {hit.phone ? (
                      <span className="text-muted-foreground"> · {hit.phone}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-muted-foreground text-xs">Default: Walk-in Customer</p>
          </div>
        )}
      </div>

      {cart.length === 0 ? (
        <p className="text-muted-foreground text-sm">Add products to start a sale.</p>
      ) : (
        <ul className="space-y-3">
          {cart.map((item) => (
            <li key={item.productId} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-muted-foreground text-xs">{formatCurrency(item.unitPrice)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() =>
                    onSetCart((prev) =>
                      prev
                        .map((row) =>
                          row.productId === item.productId
                            ? { ...row, quantity: row.quantity - 1 }
                            : row,
                        )
                        .filter((row) => row.quantity > 0),
                    )
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  aria-label={`Quantity for ${item.name}`}
                  className="h-7 w-14 px-1 text-center text-sm tabular-nums"
                  value={qtyDrafts[item.productId] ?? String(item.quantity)}
                  onChange={(e) => onSetCartQuantity(item.productId, e.target.value)}
                  onBlur={() => onCommitCartQuantity(item.productId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => {
                    const stock =
                      catalog.find((p) => p.id === item.productId)?.stockQuantity ??
                      item.quantity + 1;
                    if (item.quantity + 1 > stock) {
                      toast.error("Not enough stock");
                      return;
                    }
                    onSetCart((prev) =>
                      prev.map((row) =>
                        row.productId === item.productId
                          ? { ...row, quantity: row.quantity + 1 }
                          : row,
                      ),
                    );
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const checkoutFooter = (
    <div className="space-y-3">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Discount</span>
            <div className="flex items-center gap-1.5">
              <div
                className="bg-muted inline-flex rounded-md p-0.5"
                role="group"
                aria-label="Discount type"
              >
                <button
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors",
                    discountMode === "amount"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onDiscountMode("amount")}
                >
                  GHS
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors",
                    discountMode === "percent"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onDiscountMode("percent")}
                >
                  %
                </button>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={discountMode === "percent" ? 100 : Math.max(0, subtotal)}
                className="h-8 w-24"
                value={discountField}
                onChange={(e) => {
                  const next = Number(e.target.value) || 0;
                  onDiscountField(Math.max(0, next));
                }}
                aria-invalid={discountExceedsSubtotal}
                aria-describedby={discountExceedsSubtotal ? "cart-discount-error" : undefined}
              />
            </div>
          </div>
          {discountMode === "percent" && discountField > 0 && !discountExceedsSubtotal ? (
            <p className="text-muted-foreground text-right text-xs">
              Equals {formatCurrency(cartDiscount)}
            </p>
          ) : null}
          {discountExceedsSubtotal ? (
            <p id="cart-discount-error" className="text-destructive text-right text-xs">
              {discountMode === "percent"
                ? "Percentage cannot exceed 100%"
                : `Discount cannot exceed the subtotal (${formatCurrency(subtotal)})`}
            </p>
          ) : null}
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>
      </div>
      {actions}
    </div>
  );

  if (pinActions) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3">{body}</div>
        <div className="border-border bg-card shrink-0 border-t pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          {checkoutFooter}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {body}
      {checkoutFooter}
    </div>
  );
}
