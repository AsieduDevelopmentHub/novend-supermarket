"use client";

import { useEffect, useMemo, useState } from "react";
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
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { BranchFilter } from "@/components/filters/branch-filter";
import { formatCurrency, roundMoney } from "@/lib/currency";
import { Minus, Package, Plus, ShoppingCart, UserRound, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { printReceipt, loadTerminalPrinterConfig, probePrintBridge } from "@/services/printing";
import type { ReceiptPayload } from "@/features/receipts/types";
import { ReceiptPreviewDialog } from "@/features/receipts/components/receipt-preview-dialog";
import { useSalesCatalog, useSalesCustomerSearch } from "@/hooks/use-offline-catalog";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useOfflineStatus } from "@/providers/offline-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { getMeta, getOfflineDb, META_KEYS } from "@/lib/offline/db";
import {
  completeSaleLocally,
  holdSaleLocally,
  listLocalHeldSales,
  resumeLocalHeldSale,
} from "@/lib/offline/sales-repository";
import { findLocalProductBySku } from "@/lib/offline/snapshot";
import type { LocalHeldSale } from "@/lib/offline/types";
import { cn } from "@/lib/utils";

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
};

export function SalesView() {
  const { isAdmin, branchId: myBranchId, branchName } = usePermissions();
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
  const [localHeld, setLocalHeld] = useState<LocalHeldSale[]>([]);
  const [cashierId, setCashierId] = useState<string | null>(null);
  /** Draft qty strings while editing — empty allowed until blur. */
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  const branches = useQuery(api.branches.list, isAdmin ? {} : "skip");
  const workingBranchId = isAdmin
    ? branchOverride && branchOverride !== "all"
      ? branchOverride
      : (myBranchId ?? branches?.[0]?.id ?? null)
    : myBranchId;

  const { online, flushOutbox, dexieAvailable } = useOfflineStatus();
  const {
    products: catalog,
    loading: catalogLoading,
    refreshLocal,
  } = useSalesCatalog(search, isAdmin ? workingBranchId : undefined);
  const customerHits = useSalesCustomerSearch(customerQuery);
  const remoteHeld = useQuery(api.sales.listHeld, online ? {} : "skip");
  const holdSale = useMutation(api.sales.holdSale);
  const resumeHeld = useMutation(api.sales.resumeHeld);
  const completeSaleRemote = useMutation(api.sales.completeSale);
  const createCustomer = useMutation(api.customers.create);
  const posPrefs = useQuery(api.settings.getPosPreferences, online ? {} : "skip");

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

  async function refreshLocalHeld() {
    const rows = await listLocalHeldSales(cashierId ?? undefined);
    setLocalHeld(rows);
  }

  const heldRows: HeldRow[] = useMemo(() => {
    const localRows: HeldRow[] = localHeld.map((sale) => ({
      key: `local-${sale.id}`,
      source: "local",
      localId: sale.id,
      label: sale.label || sale.customerName || "Held cart (device)",
      total: sale.total,
    }));
    const remoteRows: HeldRow[] =
      remoteHeld?.map((sale) => ({
        key: `remote-${sale._id}`,
        source: "remote",
        remoteId: sale._id,
        label: sale.label || sale.customerName || "Held cart",
        total: sale.total,
      })) ?? [];
    return [...localRows, ...remoteRows];
  }, [localHeld, remoteHeld]);

  function addToCart(product: {
    id: string;
    name: string;
    sellingPrice: number;
    stockQuantity: number;
    isExpiring?: boolean;
  }) {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stockQuantity) {
          toast.error("Not enough stock");
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

  useBarcodeScanner(
    (code) => {
      void (async () => {
        const local = await findLocalProductBySku(code);
        const fromCatalog = catalog.find((p) => p.sku.toLowerCase() === code.toLowerCase());
        const product = local ?? fromCatalog;
        if (!product) {
          toast.error(`No product for barcode “${code}”`);
          return;
        }
        if (product.stockQuantity <= 0) {
          toast.error("Not enough stock");
          return;
        }
        addToCart(product);
        toast.success(`Added ${product.name}`);
      })();
    },
    { enabled: true, allowInInputs: true },
  );

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
      toast.error("Not enough stock");
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
    setCart([]);
    clearCartDiscount();
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
        branchId: isAdmin ? (workingBranchId ?? undefined) : undefined,
      });
      setCart([]);
      clearCartDiscount();
      toast.success("Sale held");
    } catch (error) {
      showError(error, "Hold failed");
    }
  }

  async function triggerPrint(payload: ReceiptPayload) {
    setLastReceipt(payload);
    if (posPrefs && !posPrefs.autoPrintReceipt) {
      toast.message("Receipt saved. Open the order to print it.");
      return;
    }
    const config = loadTerminalPrinterConfig();
    if (config.autoPrint && config.preferNative) {
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

  async function onPay() {
    if (!canCheckout) return;
    try {
      if (!dexieAvailable) {
        if (!online) {
          toast.error("Local storage unavailable — cannot complete sale offline");
          return;
        }
        const result = await completeSaleRemote({
          customerId: customer?.id as Id<"customers"> | undefined,
          customerName: customer?.name,
          items: cart.map((item) => ({
            productId: item.productId as Id<"products">,
            quantity: item.quantity,
            discount: item.discount,
          })),
          discount: cartDiscount,
          paymentMethod: "cash",
          branchId: isAdmin ? (workingBranchId ?? undefined) : undefined,
        });
        setCart([]);
        clearCartDiscount();
        setCustomer(null);
        setCustomerQuery("");
        toast.success(`Sale complete · ${result.invoiceNumber}`);
        await triggerPrint(result.receiptPayload as ReceiptPayload);
        return;
      }

      const result = await completeSaleLocally({
        items: cart,
        discount: cartDiscount,
        paymentMethod: "cash",
        customerId: customer?.id,
        customerName: customer?.name,
        customerPhone: customer?.phone,
      });
      setCart([]);
      clearCartDiscount();
      setCustomer(null);
      setCustomerQuery("");
      await refreshLocal();
      toast.success(
        online
          ? `Sale complete · ${result.invoiceNumber}`
          : `Sale saved offline · ${result.invoiceNumber}`,
      );
      await triggerPrint(result.receiptPayload);
      if (online) {
        void flushOutbox();
      }
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
    <div className="space-y-6 pb-24 xl:pb-0">
      <PageHeader title="Sales" description="Create a new wholesale or retail sale." />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="max-w-lg"
            />
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
              {catalog.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="border-border hover:border-primary bg-card rounded-xl border p-2 text-left shadow-sm transition sm:p-3"
                >
                  <div className="bg-muted relative mb-2 aspect-square overflow-hidden rounded-lg sm:mb-3 sm:aspect-[4/3]">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        priority={index === 0}
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 240px"
                        unoptimized
                      />
                    ) : (
                      <Package className="text-muted-foreground absolute inset-0 m-auto h-7 w-7 sm:h-8 sm:w-8" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</p>
                  <p className="text-primary mt-1 text-sm font-semibold">
                    {formatCurrency(product.sellingPrice)}
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
                    <span>
                      {sale.label} · {formatCurrency(sale.total)}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
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

        <Card className="h-fit xl:sticky xl:top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Current Sale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  onClick={() => setQuickOpen(true)}
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
                    onClick={() => setCustomer(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                    <span className="sr-only">Clear to Walk-in</span>
                  </Button>
                </div>
              ) : (
                <div className="relative space-y-1">
                  <Input
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Walk-in · search to attach…"
                  />
                  {customerHits.length > 0 ? (
                    <div className="border-border bg-card absolute z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-md">
                      {customerHits.map((hit) => (
                        <button
                          key={hit.id}
                          type="button"
                          className="hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                          onClick={() => {
                            setCustomer(hit);
                            setCustomerQuery("");
                          }}
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
                      <p className="text-muted-foreground text-xs">
                        {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() =>
                          setCart((prev) =>
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
                        onChange={(e) => setCartQuantity(item.productId, e.target.value)}
                        onBlur={() => commitCartQuantity(item.productId)}
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
                          setCart((prev) =>
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

            <div className="space-y-2 border-t pt-3 text-sm">
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
                        onClick={() => setDiscountModeAndConvert("amount")}
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
                        onClick={() => setDiscountModeAndConvert("percent")}
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
                        setDiscountField(Math.max(0, next));
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

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canCheckout}
                onClick={() => void onHold()}
              >
                Hold
              </Button>
              <Button type="button" disabled={!canCheckout} onClick={() => void onPay()}>
                Pay
              </Button>
            </div>

            {lastReceipt ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setPreviewOpen(true)}
              >
                Reprint last receipt
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/80 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {cartItemCount} {cartItemCount === 1 ? "item" : "items"} · {formatCurrency(total)}
            </p>
            {cartDiscount > 0 ? (
              <p className="text-muted-foreground text-xs">
                Discount {formatCurrency(cartDiscount)}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">Tap Pay to complete</p>
            )}
          </div>
          <Button type="button" disabled={!canCheckout} onClick={() => void onPay()}>
            Pay
          </Button>
        </div>
      </div>

      <ReceiptPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        payload={lastReceipt}
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
