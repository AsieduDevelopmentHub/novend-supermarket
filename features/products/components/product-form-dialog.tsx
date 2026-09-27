"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DialogFooter } from "@/components/ui/dialog";
import { ResponsiveFormSurface } from "@/components/layout/responsive-form-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnsignedQuantityInput } from "@/components/ui/unsigned-quantity-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LoadingState } from "@/components/feedback/loading-state";
import { generateSkuFromName } from "@/lib/sku";
import { DEFAULT_EXPIRY_ALERT_DAYS } from "@/lib/expiry";
import { assertValidImageFile, compressProductImage, IMAGE_ACCEPT } from "@/lib/uploads/image";
import { Camera, ImagePlus, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { TakeProductPhotoDialog } from "@/features/products/components/take-product-photo-dialog";
import { ProductModifiersEditor } from "@/features/dining/components/product-modifiers-editor";
import { ProductBarcodeField } from "@/features/products/components/product-barcode-field";
import {
  ProductSellUnitsEditor,
  draftsFromSellUnits,
  emptySellUnitDraft,
  parseSellUnitDrafts,
  type SellUnitDraft,
} from "@/features/products/components/product-sell-units-editor";
import { UnitPresetField } from "@/features/products/components/unit-preset-field";
import { ProductImage } from "@/components/media/product-image";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { useProductImagesPolicy } from "@/hooks/use-product-images-policy";
import { usePermissions } from "@/hooks/use-permissions";
import { useLicense } from "@/hooks/use-license";
import { featureEnabled } from "@/convex/shared/licensing";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useCategoriesList, useMirroredProduct } from "@/hooks/use-offline-lists";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueUpsertProduct,
  resolveCategoryIdForProduct,
} from "@/lib/offline/replica-writes";
import type { PricingMode, ProductSellUnit } from "@/convex/shared/units";

export type CreatedCatalogProduct = {
  id: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: Id<"products"> | null;
  /** Wholesale receive: catalog only, no opening branch stock. */
  warehouseIntake?: boolean;
  onCreated?: (product: CreatedCatalogProduct) => void;
};

type ProductDetails = {
  _id: Id<"products">;
  _creationTime: number;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId: Id<"categories">;
  sellingPrice: number;
  costPrice?: number;
  stockQuantity: number;
  unit: string;
  sellUnits?: ProductSellUnit[] | null;
  pricingMode?: PricingMode | null;
  lowStockThreshold: number;
  tracksExpiry?: boolean;
  tracksInventory?: boolean;
  expiryAlertDays?: number;
  nearestExpiry?: string | null;
  status: "active" | "inactive" | "archived";
  description?: string;
  imageUrl?: string | null;
};

export function ProductFormDialog({
  open,
  onOpenChange,
  productId,
  warehouseIntake = false,
  onCreated,
}: Props) {
  const online = useConnectivity();
  const categories = useCategoriesList();
  const mirrored = useMirroredProduct(open ? (productId as string | null) : null);
  const mirroredRow =
    mirrored && productId && mirrored.id === productId
      ? mirrored
      : mirrored === undefined
        ? undefined
        : null;

  const remoteProduct = useQuery(
    api.products.getProduct,
    open && productId && online && mirroredRow === null && !String(productId).startsWith("local_")
      ? { id: productId }
      : "skip",
  );

  const mappedLocal: ProductDetails | null | undefined =
    mirroredRow === undefined
      ? undefined
      : mirroredRow === null
        ? null
        : {
            _id: mirroredRow.id as Id<"products">,
            _creationTime: mirroredRow.updatedAt,
            name: mirroredRow.name,
            sku: mirroredRow.sku,
            barcode: mirroredRow.barcode,
            categoryId: mirroredRow.categoryId as Id<"categories">,
            sellingPrice: mirroredRow.sellingPrice,
            costPrice: mirroredRow.costPrice,
            stockQuantity: mirroredRow.stockQuantity,
            unit: mirroredRow.unit,
            sellUnits: mirroredRow.sellUnits ?? null,
            pricingMode: mirroredRow.pricingMode ?? null,
            lowStockThreshold: mirroredRow.lowStockThreshold,
            tracksExpiry: mirroredRow.tracksExpiry,
            tracksInventory: mirroredRow.tracksInventory,
            expiryAlertDays: mirroredRow.expiryAlertDays ?? undefined,
            nearestExpiry: mirroredRow.nearestExpiry ?? null,
            status: mirroredRow.status === "inactive" ? "inactive" : "active",
            imageUrl: mirroredRow.imageUrl,
          };

  const product =
    mappedLocal === undefined
      ? undefined
      : (mappedLocal ?? (remoteProduct as ProductDetails | null | undefined));
  const localReady = !productId || mirrored !== undefined;
  const waitingRemote = Boolean(
    productId && mirroredRow === null && online && remoteProduct === undefined,
  );
  const editDataReady = !productId || product !== undefined;
  const ready = open && categories !== undefined && localReady && !waitingRemote && editDataReady;
  const { hasCapability } = useBusinessCapabilities();
  const wideForm =
    hasCapability("multi_unit_pricing") ||
    hasCapability("sell_by_weight") ||
    hasCapability("lot_expiry") ||
    hasCapability("non_stock_sales");

  return (
    <ResponsiveFormSurface
      open={open}
      onOpenChange={onOpenChange}
      title={
        productId ? "Edit Product" : warehouseIntake ? "Add product to catalog" : "Add Product"
      }
      dialogClassName={wideForm ? "max-w-3xl" : "max-w-2xl"}
    >
      {!ready ? (
        <LoadingState label="Loading form…" />
      ) : (
        <ProductFormBody
          key={productId ?? "new"}
          productId={productId}
          initialProduct={(product as ProductDetails | null) ?? null}
          categories={categories ?? []}
          initialCategoryId={
            ((product as ProductDetails | null)?.categoryId as string | undefined) ??
            categories?.[0]?._id ??
            ""
          }
          onOpenChange={onOpenChange}
          warehouseIntake={warehouseIntake}
          onCreated={onCreated}
        />
      )}
    </ResponsiveFormSurface>
  );
}

function ProductFormBody({
  productId,
  initialProduct,
  categories,
  initialCategoryId,
  onOpenChange,
  warehouseIntake,
  onCreated,
}: {
  productId: Id<"products"> | null;
  initialProduct: ProductDetails | null;
  categories: Array<{ _id: Id<"categories">; name: string }>;
  initialCategoryId: string;
  onOpenChange: (open: boolean) => void;
  warehouseIntake: boolean;
  onCreated?: (product: CreatedCatalogProduct) => void;
}) {
  const createProduct = useMutation(api.products.createProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const createCategory = useMutation(api.categories.create);
  const online = useConnectivity();
  const { branchId: profileBranchId } = usePermissions();
  const { features } = useLicense();
  const { hasCapability, industryProfile } = useBusinessCapabilities();
  const productImagesPolicy = useProductImagesPolicy();
  const imagesUploadEnabled = productImagesPolicy.enabled;
  const showPacks = hasCapability("multi_unit_pricing");
  const showWeight = hasCapability("sell_by_weight");
  const showSellUnits = showPacks || showWeight;
  const showNonStock = hasCapability("non_stock_sales");
  const showModifiers = hasCapability("modifiers");
  const showExpiry = hasCapability("lot_expiry") || initialProduct?.tracksExpiry === true;
  const defaultUnit =
    industryProfile === "hotel"
      ? "night"
      : industryProfile === "restaurant" || industryProfile === "bar"
        ? "portion"
        : showPacks || showWeight
          ? "packs"
          : "pcs";

  const [name, setName] = useState(initialProduct?.name ?? "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [skuTouched, setSkuTouched] = useState(!!initialProduct);
  const [barcode, setBarcode] = useState(initialProduct?.barcode ?? "");
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [createdCategories, setCreatedCategories] = useState<
    Array<{ _id: Id<"categories">; name: string }>
  >([]);
  const [sellingPrice, setSellingPrice] = useState(String(initialProduct?.sellingPrice ?? 0));
  const [costPrice, setCostPrice] = useState(String(initialProduct?.costPrice ?? 0));
  const [tracksInventory, setTracksInventory] = useState(() => {
    if (!showNonStock) return true;
    if (initialProduct) return initialProduct.tracksInventory !== false;
    return false;
  });
  const [stockQuantity, setStockQuantity] = useState(
    String(warehouseIntake ? 0 : (initialProduct?.stockQuantity ?? 0)),
  );
  const [unit, setUnit] = useState(initialProduct?.unit ?? defaultUnit);
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    initialProduct?.pricingMode === "per_weight" ? "per_weight" : "fixed",
  );
  const [sellUnitDrafts, setSellUnitDrafts] = useState<SellUnitDraft[]>(() =>
    showSellUnits
      ? draftsFromSellUnits(
          initialProduct?.sellUnits,
          initialProduct?.unit ?? defaultUnit,
          initialProduct?.sellingPrice ?? 0,
        )
      : [emptySellUnitDraft()],
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(initialProduct?.lowStockThreshold ?? 10),
  );
  const [tracksExpiry, setTracksExpiry] = useState(
    showExpiry ? initialProduct?.tracksExpiry === true : false,
  );
  const canEditStock =
    Boolean(productId) &&
    featureEnabled(features, "products.editStock") &&
    tracksInventory &&
    tracksExpiry !== true &&
    initialProduct?.tracksExpiry !== true;
  const [expiryAlertDays, setExpiryAlertDays] = useState(
    String(initialProduct?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS),
  );
  const [expiryDate, setExpiryDate] = useState(initialProduct?.nearestExpiry ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(
    initialProduct?.status === "inactive" ? "inactive" : "active",
  );
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [pending, setPending] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const canRemoveImage =
    Boolean(file) || (!removeImage && Boolean(initialProduct?.imageUrl || productId));

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearSelectedImage() {
    setFile(null);
    setRemoveImage(true);
  }

  function onNameChange(value: string) {
    setName(value);
    if (!skuTouched && !productId) {
      setSku(value.trim() ? generateSkuFromName(value) : "");
    }
  }

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ _id: string; name: string }> = [];
    for (const row of [...createdCategories, ...categories]) {
      if (seen.has(row._id)) continue;
      seen.add(row._id);
      rows.push(row);
    }
    return rows;
  }, [categories, createdCategories]);

  function rememberCategory(id: string, name: string) {
    setCreatedCategories((current) =>
      current.some((row) => row._id === id)
        ? current
        : [{ _id: id as Id<"categories">, name }, ...current],
    );
    setCategoryId(id);
  }

  async function onCreateCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      toast.error("Enter a category name");
      return;
    }
    try {
      let createdId = "";
      const kind = await persistBusinessWrite({
        online,
        remote: async () => {
          createdId = String(await createCategory({ name: trimmed }));
        },
        local: async () => {
          createdId = await resolveCategoryIdForProduct({
            selectedId: "",
            typedName: trimmed,
          });
        },
      });
      rememberCategory(createdId, trimmed);
      setNewCategory("");
      setShowNewCategory(false);
      toast.success(queuedSaveMessage(kind, "Category created"));
    } catch (error) {
      showError(error, "Could not create category");
    }
  }

  async function applyImageFile(next: File) {
    try {
      const compressed = await compressProductImage(next);
      await assertValidImageFile(compressed);
      setRemoveImage(false);
      setFile(compressed);
    } catch (error) {
      showError(error, "Invalid image file");
    }
  }

  async function onTakePhoto() {
    // Dialog uses getUserMedia on secure origins; Cap HTTP live-reload falls
    // back to NovendCamera still capture inside the same dialog.
    setCameraOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!categoryId && !(showNewCategory && newCategory.trim())) {
      toast.error("Select a category");
      return;
    }
    if (!sku.trim()) {
      toast.error("SKU is required");
      return;
    }
    if (!unit.trim()) {
      toast.error("Select a stock unit");
      return;
    }
    setPending(true);
    try {
      let sellUnits: ProductSellUnit[] | undefined;
      let resolvedPricingMode: PricingMode | undefined;
      if (showSellUnits) {
        sellUnits = parseSellUnitDrafts(sellUnitDrafts);
        resolvedPricingMode = showWeight && pricingMode === "per_weight" ? "per_weight" : "fixed";
      }
      const resolvedUnit = unit.trim() || defaultUnit;
      const resolvedTracksInventory = showNonStock ? tracksInventory : true;
      const resolvedTracksExpiry =
        resolvedTracksInventory && showExpiry ? tracksExpiry : false;
      let savedId = productId ?? "";
      let resolvedCategoryId = categoryId;
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          productId
            ? updateProduct({
                id: productId,
                name,
                sku,
                barcode: barcode.trim(),
                categoryId: resolvedCategoryId as Id<"categories">,
                costPrice: Number(costPrice),
                sellingPrice: Number(sellingPrice),
                unit: resolvedUnit,
                ...(sellUnits ? { sellUnits } : {}),
                ...(resolvedPricingMode ? { pricingMode: resolvedPricingMode } : {}),
                lowStockThreshold: Number(lowStockThreshold),
                status,
                description,
                tracksInventory: resolvedTracksInventory,
                tracksExpiry: resolvedTracksExpiry,
                expiryAlertDays: resolvedTracksExpiry ? Number(expiryAlertDays) : undefined,
                openingExpiryDate: resolvedTracksExpiry && expiryDate ? expiryDate : undefined,
                ...(canEditStock
                  ? {
                      stockQuantity: Math.max(0, Math.floor(Number(stockQuantity) || 0)),
                      ...(profileBranchId
                        ? { stockBranchId: profileBranchId as Id<"branches"> }
                        : {}),
                    }
                  : {}),
              })
            : createProduct({
                name,
                sku,
                barcode: barcode.trim(),
                categoryId: resolvedCategoryId as Id<"categories">,
                costPrice: Number(costPrice),
                sellingPrice: Number(sellingPrice),
                stockQuantity:
                  warehouseIntake || !resolvedTracksInventory ? 0 : Number(stockQuantity),
                unit: resolvedUnit,
                ...(sellUnits ? { sellUnits } : {}),
                ...(resolvedPricingMode ? { pricingMode: resolvedPricingMode } : {}),
                lowStockThreshold: Number(lowStockThreshold),
                status,
                description,
                tracksInventory: resolvedTracksInventory,
                tracksExpiry: resolvedTracksExpiry,
                expiryAlertDays: resolvedTracksExpiry ? Number(expiryAlertDays) : undefined,
                expiryDate: resolvedTracksExpiry && expiryDate ? expiryDate : undefined,
              }),
        local: async () => {
          resolvedCategoryId = await resolveCategoryIdForProduct({
            selectedId: categoryId,
            typedName: showNewCategory ? newCategory : "",
          });
          rememberCategory(
            resolvedCategoryId,
            (showNewCategory && newCategory.trim()) ||
              categoryOptions.find((row) => row._id === resolvedCategoryId)?.name ||
              "Category",
          );
          setNewCategory("");
          setShowNewCategory(false);
          const resolvedCategoryName =
            (showNewCategory && newCategory.trim()) ||
            categoryOptions.find((row) => row._id === resolvedCategoryId)?.name ||
            "Category";
          savedId = await queueUpsertProduct({
            serverId: productId ?? undefined,
            name,
            sku,
            barcode: barcode.trim(),
            categoryId: resolvedCategoryId,
            categoryName: resolvedCategoryName,
            costPrice: Number(costPrice),
            sellingPrice: Number(sellingPrice),
            stockQuantity:
              warehouseIntake || !resolvedTracksInventory ? 0 : Number(stockQuantity),
            applyStockQuantity: Boolean(productId && canEditStock),
            unit: resolvedUnit,
            sellUnits,
            pricingMode: resolvedPricingMode,
            lowStockThreshold: Number(lowStockThreshold),
            status,
            description,
            tracksInventory: resolvedTracksInventory,
            tracksExpiry: resolvedTracksExpiry,
            expiryAlertDays: resolvedTracksExpiry ? Number(expiryAlertDays) : undefined,
            expiryDate: resolvedTracksExpiry && expiryDate ? expiryDate : undefined,
            branchId: profileBranchId ?? undefined,
            imageBlob: removeImage ? undefined : (file ?? undefined),
            hasLocalImage: removeImage ? false : Boolean(file),
            clearImage: removeImage || undefined,
          });
        },
      });
      toast.success(queuedSaveMessage(kind, productId ? "Product updated" : "Product created"));
      if (!productId && savedId) {
        onCreated?.({
          id: savedId,
          name: name.trim(),
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
        });
      }
      onOpenChange(false);
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex w-full min-w-0 flex-col gap-6" onSubmit={onSubmit}>
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Basics</h3>
              <p className="text-muted-foreground text-xs">What cashiers see on the catalog.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Product name</Label>
              <Input
                id="name"
                className="min-h-11"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Category</Label>
                <button
                  type="button"
                  className="text-primary text-xs font-medium hover:underline"
                  onClick={() => {
                    setShowNewCategory((open) => {
                      if (open) setNewCategory("");
                      return !open;
                    });
                  }}
                >
                  {showNewCategory ? "Select existing" : "Create new"}
                </button>
              </div>
              {showNewCategory ? (
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <Input
                    className="min-h-11 min-w-0"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category name"
                  />
                  <Button type="button" variant="secondary" onClick={() => void onCreateCategory()}>
                    Add
                  </Button>
                </div>
              ) : (
                <SearchableSelect
                  options={categoryOptions.map((category) => ({
                    value: category._id,
                    label: category.name,
                  }))}
                  value={categoryId || undefined}
                  onValueChange={setCategoryId}
                  placeholder="Select category"
                  searchPlaceholder="Search categories…"
                  emptyMessage="No categories found."
                />
              )}
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  className="min-h-11"
                  value={sku}
                  onChange={(e) => {
                    setSkuTouched(true);
                    setSku(e.target.value);
                  }}
                  placeholder="Auto from name"
                  required
                />
              </div>
              <div className="min-w-0 space-y-2 sm:pt-0">
                <ProductBarcodeField value={barcode} onChange={setBarcode} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Pricing & stock</h3>
              <p className="text-muted-foreground text-xs">
                {showNonStock
                  ? "Used at checkout. Turn off inventory tracking for menu items or room rates."
                  : "Used at checkout and for stock alerts."}
              </p>
            </div>
            {showNonStock ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
                <div className="min-w-0">
                  <Label htmlFor="tracks-inventory" className="text-sm font-medium">
                    Track inventory
                  </Label>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                    Off = sell without on-hand stock (menu dishes, room nights). On = normal stock
                    for drinks, supplies, or amenity SKUs.
                  </p>
                </div>
                <Switch
                  id="tracks-inventory"
                  checked={tracksInventory}
                  onCheckedChange={(checked) => {
                    setTracksInventory(checked);
                    if (!checked) setTracksExpiry(false);
                  }}
                />
              </div>
            ) : null}
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="sell">Selling price (GHC)</Label>
                <Input
                  id="sell"
                  className="min-h-11"
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  required
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="cost">Cost price (GHC)</Label>
                <Input
                  id="cost"
                  className="min-h-11"
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              {warehouseIntake ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Opening branch stock</Label>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Stays 0. Warehouse quantity is added when you save the supplier purchase.
                  </p>
                </div>
              ) : !tracksInventory ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Stock</Label>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Inventory is not tracked for this item. It stays sellable at the counter with
                    zero on-hand quantity.
                  </p>
                </div>
              ) : (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="stock">Stock quantity</Label>
                  <UnsignedQuantityInput
                    id="stock"
                    value={stockQuantity}
                    onValueChange={setStockQuantity}
                    disabled={Boolean(productId) && !canEditStock}
                    required={!productId || canEditStock}
                  />
                  {canEditStock ? (
                    <p className="text-muted-foreground text-xs">
                      You can set stock here (including from 0). Saves as an inventory adjustment
                      for your branch.
                    </p>
                  ) : productId && tracksExpiry ? (
                    <p className="text-muted-foreground text-xs">
                      Dated products: adjust stock from Inventory or Expiry lots.
                    </p>
                  ) : productId ? (
                    <p className="text-muted-foreground text-xs">
                      Stock is changed from Inventory by default. Novend can unlock editing here via
                      Entitlements → Edit product stock.
                    </p>
                  ) : null}
                </div>
              )}
              {tracksInventory ? (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="low">Low stock alert</Label>
                  <UnsignedQuantityInput
                    id="low"
                    value={lowStockThreshold}
                    onValueChange={setLowStockThreshold}
                    required
                  />
                </div>
              ) : null}
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <UnitPresetField
                  id="unit"
                  label={industryProfile === "hotel" ? "Sell unit" : "Stock unit"}
                  value={unit}
                  onChange={setUnit}
                  required
                  hint={
                    industryProfile === "hotel"
                      ? "Usually night — quantity at checkout is nights (or rooms × nights)."
                      : industryProfile === "restaurant"
                        ? "Usually portion, plate, or serving."
                        : showPacks || showWeight
                          ? "Inventory is counted in this unit. Sell units convert to it."
                          : "How you count this product (pieces, packs, cartons…)."
                  }
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as "active" | "inactive")}
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">In stock</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {showSellUnits ? (
            <section className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Advanced selling</h3>
                <p className="text-muted-foreground text-xs">
                  Enabled in Settings → Business. Hidden for simple retail shops.
                </p>
              </div>
              {showWeight ? (
                <div className="space-y-2">
                  <Label>Pricing mode</Label>
                  <Select
                    value={pricingMode}
                    onValueChange={(value) => setPricingMode(value as PricingMode)}
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed (whole / pack qty)</SelectItem>
                      <SelectItem value="per_weight">Per weight (fractional qty)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Per weight uses manual entry at checkout. Scale hardware is optional.
                  </p>
                </div>
              ) : null}
              <ProductSellUnitsEditor
                drafts={sellUnitDrafts}
                onChange={setSellUnitDrafts}
                baseUnitLabel={unit}
                showPacks={showPacks}
                showWeight={showWeight}
              />
            </section>
          ) : null}

          {showExpiry && tracksInventory ? (
            <section className="border-border space-y-3 rounded-[16px] border p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor="tracks-expiry">Track expiry dates</Label>
                </div>
                <Switch
                  id="tracks-expiry"
                  checked={tracksExpiry}
                  onCheckedChange={setTracksExpiry}
                />
              </div>
              {tracksExpiry ? (
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="alert-days">Alert days before expiry</Label>
                    <Input
                      id="alert-days"
                      type="number"
                      min="0"
                      step="1"
                      className="min-h-11 w-full min-w-0"
                      value={expiryAlertDays}
                      onChange={(e) => setExpiryAlertDays(e.target.value)}
                      required
                    />
                  </div>
                  {/*
                    Show a date when creating, or when turning expiry on for the first time.
                    Only point to Expiry lots once the product already tracked lots.
                  */}
                  {!productId ||
                  productId.startsWith("local_") ||
                  initialProduct?.tracksExpiry !== true ? (
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="opening-expiry">
                        {productId && !productId.startsWith("local_")
                          ? "Opening expiry date"
                          : "Expiry date"}
                      </Label>
                      <Input
                        id="opening-expiry"
                        type="date"
                        className="min-h-11 w-full min-w-0"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        required={
                          Number(stockQuantity) > 0 || (initialProduct?.stockQuantity ?? 0) > 0
                        }
                      />
                      {productId && !productId.startsWith("local_") ? (
                        <p className="text-muted-foreground text-xs">
                          Required when converting existing on-hand stock into dated lots.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs sm:col-span-2">
                      Edit each batch&apos;s expiry on the product page under Expiry lots.
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional notes for your team"
            />
          </section>
        </div>

        <aside className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
          <Label>Product image</Label>
          <div className="border-border bg-muted/30 relative flex aspect-square min-h-40 w-full flex-col items-center justify-center overflow-hidden rounded-[16px] border border-dashed p-4 text-center lg:min-h-0">
            {previewUrl && !removeImage ? (
              <Image
                src={previewUrl}
                alt={name || "Product preview"}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 208px"
                unoptimized
              />
            ) : productId && !removeImage ? (
              <ProductImage
                productId={productId}
                remoteUrl={initialProduct?.imageUrl}
                alt={name || "Product preview"}
                sizes="(max-width: 1024px) 100vw, 208px"
                fallback={
                  imagesUploadEnabled ? (
                    <>
                      <ImagePlus className="text-muted-foreground mb-2 h-8 w-8" />
                      <p className="text-sm font-medium">Add a photo</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        JPG, PNG, or WebP · max 2 MB
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-xs">No photo</p>
                  )
                }
              />
            ) : imagesUploadEnabled ? (
              <>
                <ImagePlus className="text-muted-foreground mb-2 h-8 w-8" />
                <p className="text-sm font-medium">Add a photo</p>
                <p className="text-muted-foreground mt-1 text-xs">JPG, PNG, or WebP · max 2 MB</p>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">Image uploads are disabled</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {imagesUploadEnabled ? (
              <>
                <Button type="button" variant="outline" size="sm" asChild>
                  <label htmlFor="image" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </label>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onTakePhoto()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Camera
                </Button>
                <Input
                  id="image"
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    const next = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (!next) return;
                    void applyImageFile(next);
                  }}
                />
              </>
            ) : null}
            {canRemoveImage ? (
              <Button type="button" variant="outline" size="sm" onClick={clearSelectedImage}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
          {!imagesUploadEnabled ? (
            <p className="text-muted-foreground text-xs">
              New photo uploads are turned off for this organization. Existing images still display
              and can be removed.
            </p>
          ) : null}
          {file && !removeImage ? (
            <p className="text-muted-foreground truncate text-xs">{file.name}</p>
          ) : null}
          {imagesUploadEnabled ? (
            <TakeProductPhotoDialog
              open={cameraOpen}
              onOpenChange={setCameraOpen}
              onCapture={(captured) => {
                void applyImageFile(captured);
              }}
            />
          ) : null}
        </aside>
      </div>

      {showModifiers && productId ? (
        <div className="mt-4">
          <ProductModifiersEditor productId={productId} />
        </div>
      ) : null}

      <DialogFooter className="gap-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save product"}
        </Button>
      </DialogFooter>
    </form>
  );
}
