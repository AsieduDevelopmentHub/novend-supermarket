"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Input } from "@/components/ui/input";
import { UnsignedQuantityInput } from "@/components/ui/unsigned-quantity-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { BranchFilter } from "@/components/filters/branch-filter";
import { formatCurrency, roundMoney } from "@/lib/currency";
import type { PaymentMethod } from "@/lib/payments";
import { evaluateSplitTender, type SplitTenderDraft } from "@/lib/sales/split-tender";
import { PaymentTenderSelector } from "./payment-tender-selector";
import { Minus, Plus, ScanBarcode, ShoppingCart, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { printReceipt, loadTerminalPrinterConfig, probePrintBridge } from "@/services/printing";
import type { ReceiptPayload } from "@/features/receipts/types";
import { ReceiptPreviewDialog } from "@/features/receipts/components/receipt-preview-dialog";
import { SaleCompletedDialog } from "@/features/receipts/components/sale-completed-dialog";
import { SalesTillClock } from "@/features/sales/components/sales-till-clock";
import { isCapacitor } from "@novend/hardware";
import { listActiveSellUnits, roundQuantity } from "@/convex/shared/units";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useBusinessTerms } from "@/hooks/use-business-terms";
import { salesViewDescription } from "@/convex/shared/businessTerms";
import {
  useSalesCatalog,
  useSalesCustomerSearch,
  catalogAvailableQuantity,
  resolveCatalogAvailable,
  type CatalogProduct,
  type CatalogStockHint,
} from "@/hooks/use-offline-catalog";
import { useBranchesList } from "@/hooks/use-offline-lists";
import { usePersistedSalesBranchId } from "@/hooks/use-sales-working-branch";
import { clearSalesWorkingBranch, writeSalesWorkingBranch } from "@/lib/sales/working-branch";
import { usePosPreferences } from "@/hooks/use-pos-preferences";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useOfflineStatus } from "@/providers/offline-provider";
import { usePermissions } from "@/hooks/use-permissions";
import { useLicense } from "@/hooks/use-license";
import { useNativeShell } from "@/hooks/use-native-shell";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import { getMeta, getOfflineDb, META_KEYS } from "@/lib/offline/db";
import { cn } from "@/lib/utils";
import {
  completeSaleLocally,
  holdSaleLocally,
  listLocalHeldSales,
  resumeLocalHeldSale,
} from "@/lib/offline/sales-repository";
import { ensureTillOpenForSale } from "@/lib/offline/till-sessions";
import { notifyReplicaChanged } from "@/lib/offline/replica-events";
import { TillSessionBanner } from "@/features/sales/components/till-session-banner";
import { queueUpsertCustomer } from "@/lib/offline/replica-writes";
import { findLocalProductsByBarcode, getLocalProductAvailability } from "@/lib/offline/snapshot";
import { postSaleReceiptAction, resolveReceiptPrintMode } from "@/lib/receipt-print-mode";
import type { LocalHeldSale } from "@/lib/offline/types";
import {
  isBarcodeScanningEnabled,
  playScanSuccessBeep,
  shouldShowCameraBarcodeButton,
  warmupBarcodeScanner,
} from "@/services/hardware";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import {
  BarcodeMatchDialog,
  type BarcodeMatchProduct,
} from "@/features/sales/components/barcode-match-dialog";
import { SellUnitPickerDialog } from "@/features/sales/components/sell-unit-picker-dialog";
import { DraggableCartFab } from "@/features/sales/components/draggable-cart-fab";
import {
  SalesProductCatalog,
  SalesProductDisplayControls,
} from "@/features/sales/components/sales-product-catalog";
import { HeldSalesPanel } from "@/features/sales/components/held-sales-panel";
import { resolveBarcodeMatch } from "@/lib/offline/barcode-lookup";
import { resolveCartLineUnitPrice } from "@/lib/sales/cart-pricing";
import type { ResolvedSellUnit } from "@/convex/shared/units";
import {
  readCartDraft,
  writeCartDraft,
  clearCartDraft,
  type CartDraftItem,
} from "@/lib/sales/cart-draft";
import { withTimeout } from "@/lib/async/with-timeout";
import { loadPrintSnapshotMeta } from "@/lib/offline/ui-cache";
import { loadShellProfile } from "@/lib/offline/shell-profile";
import { useCustomerDisplayPublisher } from "@/features/customer-display/hooks/use-customer-display-publisher";
import { useSalesProductDisplay } from "@/hooks/use-sales-product-display";

type DiscountMode = "amount" | "percent";

type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  sellUnitKey?: string;
  sellUnitLabel?: string;
  /** Base units per displayed sell unit (1 for piece). */
  factorToBase?: number;
  /** When true, quantity may be fractional (weight). */
  allowFractional?: boolean;
};

type PendingSellUnitPick = {
  product: {
    id: string;
    name: string;
    sellingPrice: number;
    stockQuantity: number;
    tracksInventory?: boolean;
    unit?: string;
    costPrice?: number;
    sellUnits?: CatalogProduct["sellUnits"];
    pricingMode?: CatalogProduct["pricingMode"];
  };
  units: ResolvedSellUnit[];
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
  const { isAdmin, branchId: myBranchId, branchName, userId } = usePermissions();
  const { access, capabilities, experience } = useLicense();
  const { hasCapability, industryProfile } = useBusinessCapabilities();
  const { terms } = useBusinessTerms();
  const multiUnitOn = hasCapability("multi_unit_pricing");
  const weightOn = hasCapability("sell_by_weight");
  const pricingOn = hasCapability("customer_pricing");
  const nativeShell = useNativeShell();
  const isDesktop = useDesktopRuntime();
  const [search, setSearch] = useState("");
  const persistedBranchId = usePersistedSalesBranchId(userId, isAdmin);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<SelectedCustomer>(null);
  const customerRef = useRef(customer);
  customerRef.current = customer;
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("amount");
  const [discountField, setDiscountField] = useState(0);
  const [lastReceipt, setLastReceipt] = useState<ReceiptPayload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saleCompleteOpen, setSaleCompleteOpen] = useState(false);
  const [printFailureMessage, setPrintFailureMessage] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [splitDrafts, setSplitDrafts] = useState<SplitTenderDraft[] | null>(null);
  const allowOnAccount = hasCapability("customer_credit") && Boolean(customer?.id);
  const payingRef = useRef(false);
  const [holding, setHolding] = useState(false);
  const holdingRef = useRef(false);
  const [localHeld, setLocalHeld] = useState<LocalHeldSale[]>([]);
  const [cashierId, setCashierId] = useState<string | null>(null);
  /** Draft qty strings while editing — empty allowed until blur. */
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  /** Last-known stock for products added this session — catalog is search-capped (~48). */
  const [stockHints, setStockHints] = useState<Record<string, CatalogStockHint>>({});
  const [barcodeMatches, setBarcodeMatches] = useState<{
    code: string;
    products: BarcodeMatchProduct[];
  } | null>(null);
  const [sellUnitPick, setSellUnitPick] = useState<PendingSellUnitPick | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const showCameraScan = shouldShowCameraBarcodeButton();
  const [hydratedCartScope, setHydratedCartScope] = useState<string | null>(null);
  const [displayBranding, setDisplayBranding] = useState<{
    tradeName: string;
    thankYouLine: string | null;
  }>({ tradeName: "Novend POS", thankYouLine: null });

  const mirroredBranches = useBranchesList();
  const branches = isAdmin ? mirroredBranches : undefined;
  const workingBranchId = (
    isAdmin ? (persistedBranchId ?? myBranchId ?? branches?.[0]?.id ?? null) : myBranchId
  ) as Id<"branches"> | null;

  useEffect(() => {
    if (!isAdmin || !userId || !persistedBranchId) return;
    if (!branches || branches.length === 0) return;
    if (branches.some((branch) => branch.id === persistedBranchId)) return;
    clearSalesWorkingBranch(userId);
  }, [isAdmin, userId, persistedBranchId, branches]);

  const { online, dexieAvailable } = useOfflineStatus();
  const {
    products: catalog,
    loading: catalogLoading,
    refreshLocal,
  } = useSalesCatalog(search, workingBranchId ?? myBranchId ?? undefined);
  const customerHits = useSalesCustomerSearch(customerQuery);

  useEffect(() => {
    if (catalog.length === 0) return;
    setStockHints((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const product of catalog) {
        const hint = {
          stockQuantity: product.stockQuantity,
          tracksInventory: product.tracksInventory,
        };
        const prior = next[product.id];
        if (
          !prior ||
          prior.stockQuantity !== hint.stockQuantity ||
          prior.tracksInventory !== hint.tracksInventory
        ) {
          next[product.id] = hint;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [catalog]);

  // Cart lines often leave the search window — refresh stock from Dexie by id.
  useEffect(() => {
    if (cart.length === 0) return;
    let cancelled = false;
    const branch = workingBranchId ?? myBranchId ?? null;
    void (async () => {
      const missing = cart
        .map((row) => row.productId)
        .filter((id) => !catalog.some((p) => p.id === id));
      if (missing.length === 0) return;
      const updates: Record<string, CatalogStockHint> = {};
      for (const productId of missing) {
        const row = await getLocalProductAvailability(productId, branch);
        if (row) updates[productId] = row;
      }
      if (cancelled || Object.keys(updates).length === 0) return;
      setStockHints((prev) => ({ ...prev, ...updates }));
    })();
    return () => {
      cancelled = true;
    };
  }, [cart, catalog, workingBranchId, myBranchId]);

  function rememberStockHint(product: {
    id: string;
    stockQuantity: number;
    tracksInventory?: boolean;
  }) {
    setStockHints((prev) => ({
      ...prev,
      [product.id]: {
        stockQuantity: product.stockQuantity,
        tracksInventory: product.tracksInventory,
      },
    }));
  }

  function availableFor(productId: string): number {
    return resolveCatalogAvailable(productId, catalog, stockHints);
  }

  const remoteHeld = useAuthedQuery(api.sales.listHeld, online ? {} : "skip");
  const holdSale = useMutation(api.sales.holdSale);
  const resumeHeld = useMutation(api.sales.resumeHeld);
  const createCustomer = useMutation(api.customers.create);
  const posPrefs = usePosPreferences();
  const { display: productDisplay, setDisplay: setProductDisplay } = useSalesProductDisplay();

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
  const splitEvaluation = splitDrafts
    ? evaluateSplitTender(splitDrafts, total, { allowOnAccount })
    : null;
  const canCheckout =
    cart.length > 0 &&
    !discountExceedsSubtotal &&
    access.canWrite &&
    (splitEvaluation === null || splitEvaluation.valid);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const catalogImages = useMemo(() => {
    const map: Record<string, string | null | undefined> = {};
    for (const product of catalog) {
      map[product.id] = product.imageUrl;
    }
    return map;
  }, [catalog]);

  const customerDisplayBranding = useMemo(
    () => ({
      tradeName: displayBranding.tradeName,
      branchName,
      thankYouLine: displayBranding.thankYouLine,
      accent: experience?.accent ?? null,
      accentForeground: experience?.accentForeground ?? null,
    }),
    [displayBranding, branchName, experience?.accent, experience?.accentForeground],
  );

  const { publishComplete } = useCustomerDisplayPublisher({
    cart,
    catalogImages,
    discountMode,
    discountField,
    subtotal,
    cartDiscount,
    total,
    customerName: customer?.name ?? null,
    paying,
    holding,
    branding: customerDisplayBranding,
    enabled: !nativeShell && capabilities.canUseCustomerDisplay,
  });

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
    warmupBarcodeScanner();
  }, []);

  useEffect(() => {
    void (async () => {
      const [snapshot, shell] = await Promise.all([loadPrintSnapshotMeta(), loadShellProfile()]);
      setDisplayBranding({
        tradeName:
          snapshot?.business.tradeName ||
          snapshot?.business.legalName ||
          shell?.organizationName ||
          "Novend POS",
        thankYouLine: snapshot?.template.thankYouLine ?? null,
      });
    })();
  }, []);

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
    queueMicrotask(() => {
      setCart((draft?.items as CartItem[] | undefined) ?? []);
      setDiscountMode(draft?.discountMode ?? "amount");
      setDiscountField(draft?.discountField ?? 0);
      setCustomer(draft?.customer ?? null);
      setQtyDrafts({});
      setHydratedCartScope(`${cashierId}:${workingBranchId}`);
    });
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
  }, [cart, discountMode, discountField, customer, cashierId, workingBranchId, hydratedCartScope]);

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

  function addToCart(
    product: {
      id: string;
      name: string;
      sellingPrice: number;
      stockQuantity: number;
      tracksInventory?: boolean;
      unit?: string;
      costPrice?: number;
      sellUnits?: CatalogProduct["sellUnits"];
      pricingMode?: CatalogProduct["pricingMode"];
      isExpiring?: boolean;
    },
    options?: { sellUnitKey?: string; skipUnitPicker?: boolean },
  ) {
    rememberStockHint(product);
    const available = catalogAvailableQuantity(product);
    if (available <= 0) {
      toast.error(`Not enough stock for ${product.name}`);
      return;
    }
    const units = listActiveSellUnits({
      unit: product.unit ?? "unit",
      sellingPrice: product.sellingPrice,
      costPrice: product.costPrice ?? 0,
      sellUnits: multiUnitOn || weightOn ? product.sellUnits : null,
      pricingMode: weightOn ? product.pricingMode : "fixed",
    });

    let unit = units[0]!;
    if (options?.sellUnitKey) {
      const matched = units.find((row) => row.key === options.sellUnitKey);
      if (matched) unit = matched;
    } else if (!options?.skipUnitPicker && multiUnitOn && units.length > 1) {
      setSellUnitPick({ product, units });
      return;
    }

    const allowFractional = weightOn && unit.pricingMode === "per_weight";
    const step = allowFractional ? 0.001 : 1;
    const existing = cart.find(
      (item) => item.productId === product.id && (item.sellUnitKey ?? "default") === unit.key,
    );
    if (existing) {
      const nextQty = roundQuantity(existing.quantity + step);
      const baseNeeded = roundQuantity(nextQty * unit.factorToBase);
      if (baseNeeded > available) {
        toast.error(
          `Not enough stock for ${product.name}. Available: ${Number.isFinite(available) ? available : product.stockQuantity}.`,
        );
        return;
      }
    }

    void (async () => {
      const nextQty = existing ? roundQuantity(existing.quantity + step) : 1;
      const unitPrice = await resolveCartLineUnitPrice({
        productId: product.id,
        sellUnit: unit,
        displayedQuantity: nextQty,
        customerId: customerRef.current?.id,
        pricingEnabled: pricingOn,
      });
      setCart((prev) => {
        const current = prev.find(
          (item) => item.productId === product.id && (item.sellUnitKey ?? "default") === unit.key,
        );
        if (current) {
          const qty = roundQuantity(current.quantity + step);
          const baseNeeded = roundQuantity(qty * unit.factorToBase);
          if (baseNeeded > available) return prev;
          return prev.map((item) =>
            item.productId === product.id && (item.sellUnitKey ?? "default") === unit.key
              ? { ...item, quantity: qty, unitPrice }
              : item,
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unitPrice,
            quantity: 1,
            discount: 0,
            sellUnitKey: unit.key,
            sellUnitLabel: unit.label,
            factorToBase: unit.factorToBase,
            allowFractional,
          },
        ];
      });
      playScanSuccessBeep();
    })();
  }

  /** Reprice open cart lines when the buyer (and their price-list group) changes. */
  function repriceCartForCustomer(nextCustomer: SelectedCustomer) {
    if (!pricingOn || cart.length === 0) return;
    void (async () => {
      const next = await Promise.all(
        cart.map(async (item) => {
          const product = catalog.find((row) => row.id === item.productId);
          const units = listActiveSellUnits({
            unit: product?.unit ?? item.sellUnitLabel ?? "unit",
            sellingPrice: product?.sellingPrice ?? item.unitPrice,
            costPrice: 0,
            sellUnits: multiUnitOn || weightOn ? product?.sellUnits : null,
            pricingMode: weightOn ? product?.pricingMode : "fixed",
          });
          const unit =
            units.find((row) => row.key === (item.sellUnitKey ?? "default")) ?? units[0]!;
          const unitPrice = await resolveCartLineUnitPrice({
            productId: item.productId,
            sellUnit: unit,
            displayedQuantity: item.quantity,
            customerId: nextCustomer?.id,
            pricingEnabled: pricingOn,
          });
          return { ...item, unitPrice };
        }),
      );
      setCart(next);
    })();
  }

  function addScannedProduct(product: BarcodeMatchProduct) {
    if (catalogAvailableQuantity(product) <= 0) {
      toast.error(`Not enough stock for ${product.name}`);
      return;
    }
    addToCart(product, {
      sellUnitKey: product.matchedSellUnitKey,
      skipUnitPicker: Boolean(product.matchedSellUnitKey),
    });
    toast.success(
      product.matchedSellUnitKey
        ? `Added ${product.name}`
        : `Added ${product.name}`,
    );
  }

  function handleBarcodeScan(code: string) {
    void (async () => {
      const localMatches = await findLocalProductsByBarcode(
        code,
        workingBranchId ?? myBranchId ?? undefined,
      );
      const catalogMatches = catalog
        .flatMap((p): BarcodeMatchProduct[] => {
          const match = resolveBarcodeMatch(p, code);
          if (!match) return [];
          return [{
            id: p.id,
            name: p.name,
            sku: p.sku,
            sellingPrice: p.sellingPrice,
            stockQuantity: p.stockQuantity,
            tracksInventory: p.tracksInventory,
            imageUrl: p.imageUrl,
            costPrice: undefined as number | undefined,
            unit: p.unit,
            sellUnits: p.sellUnits,
            pricingMode: p.pricingMode,
            matchedSellUnitKey: match.sellUnitKey,
          }];
        });
      const byId = new Map<string, BarcodeMatchProduct>();
      for (const product of [...localMatches, ...catalogMatches]) {
        byId.set(product.id, {
          id: product.id,
          name: product.name,
          sku: product.sku,
          sellingPrice: product.sellingPrice,
          stockQuantity: product.stockQuantity,
          tracksInventory: product.tracksInventory,
          imageUrl: product.imageUrl,
          costPrice: "costPrice" in product ? product.costPrice : undefined,
          unit: "unit" in product ? product.unit : undefined,
          sellUnits: "sellUnits" in product ? product.sellUnits : undefined,
          pricingMode: "pricingMode" in product ? product.pricingMode : undefined,
          matchedSellUnitKey:
            "matchedSellUnitKey" in product ? product.matchedSellUnitKey : undefined,
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

  function cartLineKey(productId: string, sellUnitKey?: string) {
    return `${productId}:${sellUnitKey ?? "default"}`;
  }

  function setCartQuantity(lineKey: string, raw: string) {
    setQtyDrafts((prev) => ({ ...prev, [lineKey]: raw }));
  }

  function commitCartQuantity(lineKey: string) {
    const draft = qtyDrafts[lineKey];
    const [productId, sellUnitKey = "default"] = lineKey.split(":");
    const line = cart.find(
      (row) =>
        row.productId === productId && (row.sellUnitKey ?? "default") === sellUnitKey,
    );
    const stock = availableFor(productId!);
    const factor = line?.factorToBase ?? 1;
    const current = line?.quantity ?? 1;

    if (draft === undefined) return;

    const trimmed = draft.trim();
    if (trimmed === "") {
      setQtyDrafts((prev) => {
        const next = { ...prev };
        delete next[lineKey];
        return next;
      });
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error("Enter a quantity of at least 1");
      setQtyDrafts((prev) => {
        const next = { ...prev };
        delete next[lineKey];
        return next;
      });
      setCart((prev) =>
        prev.map((row) =>
          row.productId === productId && (row.sellUnitKey ?? "default") === sellUnitKey
            ? { ...row, quantity: current }
            : row,
        ),
      );
      return;
    }

    const maxDisplay = Number.isFinite(stock) ? Math.floor(stock / factor) : parsed;
    const quantity = Number.isFinite(stock) ? Math.min(parsed, maxDisplay) : parsed;
    if (Number.isFinite(stock) && parsed > maxDisplay) {
      toast.error(`Not enough stock. Available: ${maxDisplay} ${line?.sellUnitLabel ?? "units"}.`);
    }
    setCart((prev) =>
      prev.map((row) =>
        row.productId === productId && (row.sellUnitKey ?? "default") === sellUnitKey
          ? { ...row, quantity }
          : row,
      ),
    );
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[lineKey];
      return next;
    });
  }

  function changeBranch(next: Id<"branches"> | "all") {
    if (next === "all" || !userId) return;
    setStockHints({});
    writeSalesWorkingBranch(userId, next);
  }

  async function onHold() {
    if (!access.canWrite) {
      toast.error(access.reason ?? "This business cannot record new activity right now.");
      return;
    }
    if (!canCheckout || holdingRef.current || payingRef.current) return;

    const saleBranchId = (isAdmin ? workingBranchId : myBranchId) ?? undefined;
    const holdPayload = {
      customerId: customer?.id as Id<"customers"> | undefined,
      customerName: customer?.name,
      items: cart.map((item) => ({
        productId: item.productId as Id<"products">,
        quantity: item.quantity,
        discount: item.discount,
        sellUnitKey: item.sellUnitKey,
      })),
      discount: cartDiscount,
      branchId: saleBranchId,
    };

    holdingRef.current = true;
    setHolding(true);
    try {
      // Local-first: clear cart + toast immediately. Cap often reports online while
      // Convex hangs — remote-first left Holding… stuck and revived the cart draft.
      if (!dexieAvailable) {
        if (!online) {
          toast.error("Local storage unavailable — cannot hold sale offline");
          return;
        }
        await withTimeout(holdSale(holdPayload), 10_000, "Hold timed out — try again");
        clearCartDraft();
        setCart([]);
        clearCartDiscount();
        setCustomer(null);
        setCustomerQuery("");
        setCheckoutOpen(false);
        toast.success("Sale held");
        return;
      }

      const db = await getOfflineDb();
      if (!db) throw new Error("Local database unavailable");
      const uid = cashierId ?? (await getMeta(db, META_KEYS.profileUserId)) ?? "local";
      const held = await holdSaleLocally({
        cashierId: uid,
        customerId: customer?.id,
        customerName: customer?.name,
        items: cart,
        discount: cartDiscount,
      });
      clearCartDraft();
      setCart([]);
      clearCartDiscount();
      setCustomer(null);
      setCustomerQuery("");
      setCheckoutOpen(false);
      await refreshLocalHeld();
      toast.success(
        online ? "Sale held — syncing when the server is reachable" : "Sale held on this device",
      );

      if (online) {
        void (async () => {
          try {
            await withTimeout(holdSale(holdPayload), 12_000, "Hold sync timed out");
            await db.heldSales.delete(held.id);
            await refreshLocalHeld();
          } catch {
            /* keep local hold until a later sync path exists */
          }
        })();
      }
    } catch (error) {
      showError(error, "Hold failed");
    } finally {
      holdingRef.current = false;
      setHolding(false);
    }
  }

  async function triggerPrint(payload: ReceiptPayload) {
    setLastReceipt(payload);
    const printMode = resolveReceiptPrintMode(posPrefs);
    const action = postSaleReceiptAction(printMode);
    if (action === "none") {
      return;
    }
    if (isCapacitor()) {
      if (action === "prompt") {
        setPrintFailureMessage(null);
        setSaleCompleteOpen(true);
        return;
      }
      const result = await printReceipt(payload);
      if (result.printed) {
        toast.success(
          result.reason === "download"
            ? "Receipt PDF saved to Downloads"
            : "Receipt sent to printer",
        );
        return;
      }
      const failure =
        result.failureMessage ||
        "Could not print to the Bluetooth printer. Retry, open Hardware settings, or Share / Save PDF.";
      toast.error(failure);
      setPrintFailureMessage(failure);
      setSaleCompleteOpen(true);
      return;
    }
    if (action === "prompt") {
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

  function clearCustomer() {
    setCustomer(null);
    repriceCartForCustomer(null);
    // On account needs a customer, so drop it from whichever tender mode is active.
    if (paymentMethod === "on_account") setPaymentMethod("cash");
  }

  async function onPay() {
    if (!access.canWrite) {
      toast.error(access.reason ?? "This business cannot record new activity right now.");
      return;
    }
    if (!canCheckout || payingRef.current) return;
    const saleBranchId = (isAdmin ? workingBranchId : myBranchId) ?? undefined;
    if (!saleBranchId) {
      toast.error("Select a branch before completing this sale");
      return;
    }
    const oversold = cart.find((item) => {
      const product = catalog.find((p) => p.id === item.productId);
      const available = availableFor(item.productId);
      const factor = item.sellUnitKey
        ? (listActiveSellUnits({
            unit: "unit",
            sellingPrice: item.unitPrice,
            costPrice: 0,
            sellUnits: product?.sellUnits,
            pricingMode: product?.pricingMode,
          }).find((u) => u.key === item.sellUnitKey)?.factorToBase ?? 1)
        : 1;
      return roundQuantity(item.quantity * factor) > available;
    });
    if (oversold) {
      const available = availableFor(oversold.productId);
      toast.error(`Not enough stock for ${oversold.name}. Available: ${available}.`);
      return;
    }
    if (!dexieAvailable) {
      toast.error("Local storage unavailable — cannot complete sale offline");
      return;
    }

    payingRef.current = true;
    setPaying(true);
    try {
      // Dexie-only: auto-start today with float 0 if the cashier has not started yet.
      await ensureTillOpenForSale({ branchId: saleBranchId });
      const result = await completeSaleLocally({
        items: cart,
        discount: cartDiscount,
        paymentMethod,
        payments: splitEvaluation?.payments,
        customerId: customer?.id,
        customerName: customer?.name,
        customerPhone: customer?.phone,
        branchId: saleBranchId,
      });
      setCart([]);
      clearCartDiscount();
      setCustomer(null);
      setCustomerQuery("");
      setPaymentMethod("cash");
      setSplitDrafts(null);
      setCheckoutOpen(false);
      await refreshLocal();
      notifyReplicaChanged({ flush: true });
      publishComplete(result.receiptPayload);
      toast.success(`Sale saved · ${result.invoiceNumber}`, { id: "sale-complete" });
      try {
        await triggerPrint(result.receiptPayload);
      } catch {
        toast.error("Sale saved. Reprint the receipt if the printer did not fire.");
      }
    } catch (error) {
      showError(error, "Payment failed");
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  }

  async function onResume(rowKey: string, mode: "replace" | "merge") {
    const row = heldRows.find((entry) => entry.key === rowKey);
    if (!row) return;

    try {
      let items: CartItem[] = [];
      let heldDiscount = 0;
      let heldCustomer: SelectedCustomer = null;

      if (row.source === "local" && row.localId) {
        const heldSale = await resumeLocalHeldSale(row.localId);
        items = heldSale.items.map((item) => ({
          productId: item.productId,
          name: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discount: item.discount,
        }));
        heldDiscount = heldSale.discount;
        heldCustomer = heldSale.customerId
          ? {
              id: heldSale.customerId,
              name: heldSale.customerName ?? "Customer",
              phone: null,
            }
          : null;
        await refreshLocalHeld();
      } else if (row.remoteId) {
        const heldSale = await resumeHeld({ id: row.remoteId });
        items = heldSale.items.map((item) => ({
          productId: item.productId,
          name: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discount: item.discount,
        }));
        heldDiscount = heldSale.discount;
        heldCustomer = heldSale.customerId
          ? {
              id: heldSale.customerId,
              name: heldSale.customerName ?? "Customer",
              phone: null,
            }
          : null;
      } else {
        return;
      }

      if (mode === "merge") {
        setCart((prev) => [...prev, ...items]);
        setDiscountMode("amount");
        setDiscountField((prev) => roundMoney(prev + heldDiscount));
        if (!customer && heldCustomer) {
          setCustomer(heldCustomer);
        }
        toast.success("Held sale merged into cart");
        return;
      }

      setCart(items);
      setDiscountMode("amount");
      setDiscountField(heldDiscount);
      setCustomer(heldCustomer);
      toast.success("Held sale resumed");
    } catch (error) {
      showError(error, "Resume failed");
    }
  }

  async function onQuickCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = quickName.trim();
    if (!name) {
      toast.error("Enter a customer name");
      return;
    }
    const phone = quickPhone.trim() || undefined;
    try {
      let id: string;
      if (dexieAvailable) {
        id = await queueUpsertCustomer({ name, phone });
        notifyReplicaChanged({ flush: online });
      } else if (online) {
        id = await createCustomer({ name, phone });
      } else {
        toast.error("Local storage unavailable — cannot create customer offline");
        return;
      }
      setCustomer({ id, name, phone: phone ?? null });
      setQuickOpen(false);
      setQuickName("");
      setQuickPhone("");
      setCustomerQuery("");
      toast.success(
        online ? "Customer added to sale" : "Customer added to sale — will sync when online",
      );
    } catch (error) {
      showError(error, "Could not create customer");
    }
  }

  return (
    <div
      className={cn(
        "space-y-4 xl:pb-0",
        nativeShell ? "pb-[calc(var(--novend-tabbar-offset)+3.75rem)]" : "pb-24",
      )}
    >
      <PageHeader
        title="Sales"
        description={salesViewDescription(industryProfile, terms)}
        actions={
          <TillSessionBanner branchId={workingBranchId ?? myBranchId} compact />
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="min-w-0 space-y-4">
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/90 border-border sticky top-0 z-20 -mx-1 flex flex-wrap items-end gap-2 border-b px-1 py-2.5 backdrop-blur">
            <div className="flex max-w-lg min-w-0 flex-1 basis-full gap-2 sm:basis-auto">
              <Input
                data-tour="sales-search"
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
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <SalesProductDisplayControls
                display={productDisplay}
                onDisplayChange={setProductDisplay}
              />
              <HeldSalesPanel
                heldSales={heldRows}
                cartHasItems={cart.length > 0}
                onResume={onResume}
              />
            </div>
            {isAdmin ? (
              <BranchFilter
                branches={branches}
                value={workingBranchId}
                onChange={changeBranch}
                allowAll={false}
                label="Selling from"
                className="min-w-0"
              />
            ) : branchName ? (
              <BranchFilter
                branches={undefined}
                value={myBranchId}
                onChange={() => undefined}
                lockedLabel={branchName}
                label="Branch"
                className="min-w-0"
              />
            ) : null}
          </div>
          <SalesProductCatalog
            products={catalog}
            loading={catalogLoading}
            display={productDisplay}
            onAddToCart={addToCart}
          />
        </div>

        <Card
          data-tour="sales-cart"
          className="hidden self-start xl:sticky xl:top-3 xl:flex xl:max-h-[calc(100dvh-2rem)] xl:flex-col xl:overflow-hidden"
        >
          <CardHeader className="bg-card shrink-0 px-3 py-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" aria-hidden />
                Current Sale
              </span>
              <HeldSalesPanel
                heldSales={heldRows}
                cartHasItems={cart.length > 0}
                onResume={onResume}
                compact
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-0 pb-0">
            <SalesCheckoutFields
              canQuickCreate={dexieAvailable || online}
              online={online}
              customer={customer}
              customerQuery={customerQuery}
              customerHits={customerHits}
              cart={cart}
              stockHints={stockHints}
              catalog={catalog}
              qtyDrafts={qtyDrafts}
              subtotal={subtotal}
              cartDiscount={cartDiscount}
              total={total}
              discountMode={discountMode}
              discountField={discountField}
              discountExceedsSubtotal={discountExceedsSubtotal}
              canCheckout={canCheckout}
              paying={paying}
              holding={holding}
              lastReceipt={lastReceipt}
              pinActions
              onQuickCreate={() => setQuickOpen(true)}
              onClearCustomer={clearCustomer}
              onCustomerQuery={setCustomerQuery}
              onSelectCustomer={(hit) => {
                setCustomer(hit);
                setCustomerQuery("");
                repriceCartForCustomer(hit);
              }}
              onSetCart={setCart}
              onSetCartQuantity={setCartQuantity}
              onCommitCartQuantity={commitCartQuantity}
              onDiscountMode={setDiscountModeAndConvert}
              onDiscountField={setDiscountField}
              paymentMethod={paymentMethod}
              onPaymentMethod={setPaymentMethod}
              splitDrafts={splitDrafts}
              onSplitDrafts={setSplitDrafts}
              allowOnAccount={allowOnAccount}
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
            <DrawerTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" aria-hidden />
                Current Sale
              </span>
              <HeldSalesPanel
                heldSales={heldRows}
                cartHasItems={cart.length > 0}
                onResume={onResume}
                compact
              />
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 pt-2">
            <SalesCheckoutFields
              canQuickCreate={dexieAvailable || online}
              online={online}
              customer={customer}
              customerQuery={customerQuery}
              customerHits={customerHits}
              cart={cart}
              stockHints={stockHints}
              catalog={catalog}
              qtyDrafts={qtyDrafts}
              subtotal={subtotal}
              cartDiscount={cartDiscount}
              total={total}
              discountMode={discountMode}
              discountField={discountField}
              discountExceedsSubtotal={discountExceedsSubtotal}
              canCheckout={canCheckout}
              paying={paying}
              holding={holding}
              lastReceipt={lastReceipt}
              pinActions
              onQuickCreate={() => setQuickOpen(true)}
              onClearCustomer={clearCustomer}
              onCustomerQuery={setCustomerQuery}
              onSelectCustomer={(hit) => {
                setCustomer(hit);
                setCustomerQuery("");
                repriceCartForCustomer(hit);
              }}
              onSetCart={setCart}
              onSetCartQuantity={setCartQuantity}
              onCommitCartQuantity={commitCartQuantity}
              onDiscountMode={setDiscountModeAndConvert}
              onDiscountField={setDiscountField}
              paymentMethod={paymentMethod}
              onPaymentMethod={setPaymentMethod}
              splitDrafts={splitDrafts}
              onSplitDrafts={setSplitDrafts}
              allowOnAccount={allowOnAccount}
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
        onOpenChange={(open) => {
          setSaleCompleteOpen(open);
          if (!open) setPrintFailureMessage(null);
        }}
        payload={lastReceipt}
        printMode={resolveReceiptPrintMode(posPrefs)}
        printFailureMessage={printFailureMessage}
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
      <SellUnitPickerDialog
        open={sellUnitPick != null}
        product={
          sellUnitPick
            ? {
                id: sellUnitPick.product.id,
                name: sellUnitPick.product.name,
                stockQuantity: sellUnitPick.product.stockQuantity,
                tracksInventory: sellUnitPick.product.tracksInventory,
              }
            : null
        }
        units={sellUnitPick?.units ?? []}
        onCancel={() => setSellUnitPick(null)}
        onSelect={(unitKey) => {
          const pending = sellUnitPick;
          setSellUnitPick(null);
          if (!pending) return;
          addToCart(pending.product, { sellUnitKey: unitKey, skipUnitPicker: true });
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
              <Button type="submit" disabled={!quickName.trim() || (!dexieAvailable && !online)}>
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
  canQuickCreate: boolean;
  online: boolean;
  customer: SelectedCustomer;
  customerQuery: string;
  customerHits: CheckoutCustomerHit[];
  cart: CartItem[];
  stockHints: Record<string, CatalogStockHint>;
  catalog: Array<{ id: string; stockQuantity: number; tracksInventory?: boolean }>;
  qtyDrafts: Record<string, string>;
  subtotal: number;
  cartDiscount: number;
  total: number;
  discountMode: DiscountMode;
  discountField: number;
  discountExceedsSubtotal: boolean;
  canCheckout: boolean;
  paying?: boolean;
  holding?: boolean;
  lastReceipt: ReceiptPayload | null;
  /** Pin Hold/Pay to the bottom of a full-height sheet (mobile checkout drawer). */
  pinActions?: boolean;
  onQuickCreate: () => void;
  onClearCustomer: () => void;
  onCustomerQuery: (value: string) => void;
  onSelectCustomer: (hit: CheckoutCustomerHit) => void;
  onSetCart: Dispatch<SetStateAction<CartItem[]>>;
  onSetCartQuantity: (lineKey: string, raw: string) => void;
  onCommitCartQuantity: (lineKey: string) => void;
  onDiscountMode: (mode: DiscountMode) => void;
  onDiscountField: (value: number) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethod: (method: PaymentMethod) => void;
  splitDrafts: SplitTenderDraft[] | null;
  onSplitDrafts: (drafts: SplitTenderDraft[] | null) => void;
  allowOnAccount: boolean;
  onHold: () => void;
  onPay: () => void;
  onReprint: () => void;
};

function SalesCheckoutFields({
  canQuickCreate,
  online,
  customer,
  customerQuery,
  customerHits,
  cart,
  stockHints,
  catalog,
  qtyDrafts,
  subtotal,
  cartDiscount,
  total,
  discountMode,
  discountField,
  discountExceedsSubtotal,
  canCheckout,
  paying = false,
  holding = false,
  lastReceipt,
  pinActions = false,
  onQuickCreate,
  onClearCustomer,
  onCustomerQuery,
  onSelectCustomer,
  onSetCart,
  onSetCartQuantity,
  onCommitCartQuantity,
  paymentMethod,
  onPaymentMethod,
  splitDrafts,
  onSplitDrafts,
  allowOnAccount,
  onDiscountMode,
  onDiscountField,
  onHold,
  onPay,
  onReprint,
}: SalesCheckoutFieldsProps) {
  const displayCart = cart.slice().reverse();

  const actions = (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9"
          disabled={!canCheckout || paying || holding}
          onClick={onHold}
        >
          {holding ? "Holding…" : "Hold"}
        </Button>
        <Button
          type="button"
          data-tour="sales-checkout"
          size="sm"
          className="h-9"
          disabled={!canCheckout || paying || holding}
          onClick={onPay}
        >
          {paying ? "Saving…" : "Pay"}
        </Button>
      </div>
      <SalesTillClock showFixCta={!online} compact />
      {lastReceipt ? (
        <Button
          type="button"
          variant="link"
          className="text-muted-foreground h-auto w-full px-0 py-0 text-[11px]"
          onClick={onReprint}
        >
          Reprint last receipt
        </Button>
      ) : null}
    </div>
  );

  const body = (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
            <UserRound className="h-3 w-3" />
            Customer
          </Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px]"
            disabled={!canQuickCreate}
            title={!canQuickCreate ? "Local storage unavailable" : undefined}
            onClick={onQuickCreate}
          >
            Quick create
          </Button>
        </div>
        {customer ? (
          <div className="border-border flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">{customer.name}</p>
              {customer.phone ? (
                <p className="text-muted-foreground truncate text-[11px] leading-tight">
                  {customer.phone}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={onClearCustomer}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Clear to Walk-in</span>
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              value={customerQuery}
              onChange={(e) => onCustomerQuery(e.target.value)}
              placeholder="Walk-in · search to attach…"
              className="h-8 text-sm"
            />
            {customerHits.length > 0 ? (
              <div className="border-border bg-card absolute z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-md">
                {customerHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="hover:bg-muted block w-full px-3 py-1.5 text-left text-sm"
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
          </div>
        )}
      </div>

      {cart.length === 0 ? (
        <p className="text-muted-foreground py-2 text-sm">Add products to start a sale.</p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {displayCart.map((item) => {
            const lineKey = `${item.productId}:${item.sellUnitKey ?? "default"}`;
            function matchesLine(row: CartItem) {
              return (
                row.productId === item.productId &&
                (row.sellUnitKey ?? "default") === (item.sellUnitKey ?? "default")
              );
            }
            return (
              <li key={lineKey} className="flex items-center justify-between gap-1.5 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-tight font-medium">
                    {item.name}
                    <span className="text-muted-foreground ml-1.5 text-[11px] font-normal">
                      {formatCurrency(item.unitPrice)}
                      {item.sellUnitLabel ? ` · ${item.sellUnitLabel}` : null}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-6 w-6"
                    aria-label={`Decrease ${item.name}`}
                    onClick={() =>
                      onSetCart((prev) =>
                        prev
                          .map((row) =>
                            matchesLine(row) ? { ...row, quantity: row.quantity - 1 } : row,
                          )
                          .filter((row) => row.quantity > 0),
                      )
                    }
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <UnsignedQuantityInput
                    aria-label={`Quantity for ${item.name}`}
                    className="h-6 w-10 px-0.5 text-center text-xs"
                    value={qtyDrafts[lineKey] ?? String(item.quantity)}
                    onValueChange={(next) => onSetCartQuantity(lineKey, next)}
                    onBlur={() => onCommitCartQuantity(lineKey)}
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
                    className="h-6 w-6"
                    aria-label={`Increase ${item.name}`}
                    onClick={() => {
                      const stock = resolveCatalogAvailable(item.productId, catalog, stockHints);
                      const factor = item.factorToBase ?? 1;
                      const nextQty = item.quantity + 1;
                      const baseNeeded = nextQty * factor;
                      if (Number.isFinite(stock) && baseNeeded > stock) {
                        toast.error(
                          `Not enough stock. Available: ${Math.floor(stock / factor)} ${item.sellUnitLabel ?? "units"}.`,
                        );
                        return;
                      }
                      onSetCart((prev) =>
                        prev.map((row) =>
                          matchesLine(row) ? { ...row, quantity: row.quantity + 1 } : row,
                        ),
                      );
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive h-6 w-6"
                    aria-label={`Remove ${item.name} from cart`}
                    onClick={() => onSetCart((prev) => prev.filter((row) => !matchesLine(row)))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  const checkoutFooter = (
    <div className="space-y-2">
      <div className="space-y-1.5 text-sm">
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>Subtotal</span>
          <span className="text-foreground tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">Discount</span>
          <div className="flex items-center gap-1">
            <div
              className="bg-muted inline-flex rounded-md p-0.5"
              role="group"
              aria-label="Discount type"
            >
              <button
                type="button"
                className={cn(
                  "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
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
                  "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
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
              className="h-7 w-16 text-xs"
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
          <p className="text-muted-foreground text-right text-[11px]">
            Equals {formatCurrency(cartDiscount)}
          </p>
        ) : null}
        {discountExceedsSubtotal ? (
          <p id="cart-discount-error" className="text-destructive text-right text-[11px]">
            {discountMode === "percent"
              ? "Percentage cannot exceed 100%"
              : `Discount cannot exceed the subtotal (${formatCurrency(subtotal)})`}
          </p>
        ) : null}
        <PaymentTenderSelector
          total={total}
          paymentMethod={paymentMethod}
          onPaymentMethod={onPaymentMethod}
          splitDrafts={splitDrafts}
          onSplitDrafts={onSplitDrafts}
          allowOnAccount={allowOnAccount}
          compact
        />
        <div className="flex items-baseline justify-between pt-0.5 text-sm font-semibold">
          <span>Total</span>
          <span className="text-primary text-base tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
      {actions}
    </div>
  );

  if (pinActions) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {/* flex-1 only consumes free space when the card hits max-height; short carts stay compact. */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">{body}</div>
        <div className="border-border bg-card shrink-0 border-t pt-2 pb-3">
          {checkoutFooter}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {body}
      {checkoutFooter}
    </div>
  );
}
