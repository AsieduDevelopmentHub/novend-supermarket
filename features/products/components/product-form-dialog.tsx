"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DialogFooter } from "@/components/ui/dialog";
import { ResponsiveFormSurface } from "@/components/layout/responsive-form-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Camera, ImagePlus, Upload } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { TakeProductPhotoDialog } from "@/features/products/components/take-product-photo-dialog";
import { ProductBarcodeField } from "@/features/products/components/product-barcode-field";
import { ProductImage } from "@/components/media/product-image";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useCategoriesList, useMirroredProduct } from "@/hooks/use-offline-lists";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueCreateCategory,
  queueUpsertProduct,
} from "@/lib/offline/replica-writes";
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
  lowStockThreshold: number;
  tracksExpiry?: boolean;
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
    open &&
      productId &&
      online &&
      mirroredRow === null &&
      !String(productId).startsWith("local_")
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
            lowStockThreshold: mirroredRow.lowStockThreshold,
            tracksExpiry: mirroredRow.tracksExpiry,
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

  return (
    <ResponsiveFormSurface
      open={open}
      onOpenChange={onOpenChange}
      title={
        productId ? "Edit Product" : warehouseIntake ? "Add product to catalog" : "Add Product"
      }
      dialogClassName="max-w-3xl"
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

  const [name, setName] = useState(initialProduct?.name ?? "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [skuTouched, setSkuTouched] = useState(!!initialProduct);
  const [barcode, setBarcode] = useState(initialProduct?.barcode ?? "");
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [sellingPrice, setSellingPrice] = useState(String(initialProduct?.sellingPrice ?? 0));
  const [costPrice, setCostPrice] = useState(String(initialProduct?.costPrice ?? 0));
  const [stockQuantity, setStockQuantity] = useState(
    String(warehouseIntake ? 0 : (initialProduct?.stockQuantity ?? 0)),
  );
  const [unit, setUnit] = useState(initialProduct?.unit ?? "packs");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(initialProduct?.lowStockThreshold ?? 10),
  );
  const [tracksExpiry, setTracksExpiry] = useState(initialProduct?.tracksExpiry === true);
  const [expiryAlertDays, setExpiryAlertDays] = useState(
    String(initialProduct?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS),
  );
  const [expiryDate, setExpiryDate] = useState(initialProduct?.nearestExpiry ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(
    initialProduct?.status === "inactive" ? "inactive" : "active",
  );
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onNameChange(value: string) {
    setName(value);
    if (!skuTouched && !productId) {
      setSku(value.trim() ? generateSkuFromName(value) : "");
    }
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
          createdId = await queueCreateCategory(trimmed);
        },
      });
      setCategoryId(createdId);
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
      setFile(compressed);
    } catch (error) {
      showError(error, "Invalid image file");
    }
  }

  async function onTakePhoto() {
    // Same in-app getUserMedia camera as barcode. Native Camera / NovendCamera
    // hangs the Capacitor bridge after the hosted origin loads.
    setCameraOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!categoryId) {
      toast.error("Select a category");
      return;
    }
    if (!sku.trim()) {
      toast.error("SKU is required");
      return;
    }
    setPending(true);
    try {
      let savedId = productId ?? "";
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          productId
            ? updateProduct({
                id: productId,
                name,
                sku,
                barcode: barcode.trim(),
                categoryId: categoryId as Id<"categories">,
                costPrice: Number(costPrice),
                sellingPrice: Number(sellingPrice),
                unit,
                lowStockThreshold: Number(lowStockThreshold),
                status,
                description,
                tracksExpiry,
                expiryAlertDays: tracksExpiry ? Number(expiryAlertDays) : undefined,
                openingExpiryDate: tracksExpiry && expiryDate ? expiryDate : undefined,
              })
            : createProduct({
                name,
                sku,
                barcode: barcode.trim(),
                categoryId: categoryId as Id<"categories">,
                costPrice: Number(costPrice),
                sellingPrice: Number(sellingPrice),
                stockQuantity: warehouseIntake ? 0 : Number(stockQuantity),
                unit,
                lowStockThreshold: Number(lowStockThreshold),
                status,
                description,
                tracksExpiry,
                expiryAlertDays: tracksExpiry ? Number(expiryAlertDays) : undefined,
                expiryDate: tracksExpiry && expiryDate ? expiryDate : undefined,
              }),
        local: async () => {
          savedId = await queueUpsertProduct({
            serverId: productId ?? undefined,
            name,
            sku,
            barcode: barcode.trim(),
            categoryId,
            costPrice: Number(costPrice),
            sellingPrice: Number(sellingPrice),
            stockQuantity: warehouseIntake ? 0 : Number(stockQuantity),
            unit,
            lowStockThreshold: Number(lowStockThreshold),
            status,
            description,
            tracksExpiry,
            expiryAlertDays: tracksExpiry ? Number(expiryAlertDays) : undefined,
            expiryDate: tracksExpiry && expiryDate ? expiryDate : undefined,
            imageBlob: file ?? undefined,
            hasLocalImage: Boolean(file),
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
    <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Product Name</Label>
          <Input id="name" value={name} onChange={(e) => onNameChange(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => {
              setSkuTouched(true);
              setSku(e.target.value);
            }}
            placeholder="Auto-generated from name"
            required
          />
          <p className="text-muted-foreground text-xs">
            Generated from the product name. Edit if you need a custom code.
          </p>
        </div>
        <ProductBarcodeField value={barcode} onChange={setBarcode} />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Category</Label>
            <button
              type="button"
              className="text-primary text-xs font-medium hover:underline"
              onClick={() => setShowNewCategory((v) => !v)}
            >
              {showNewCategory ? "Select existing" : "Create new"}
            </button>
          </div>
          {showNewCategory ? (
            <div className="flex gap-2">
              <Input
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
              options={categories.map((category) => ({
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="sell">Selling Price (GHC)</Label>
            <Input
              id="sell"
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost">Cost Price (GHC)</Label>
            <Input
              id="cost"
              type="number"
              min="0"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {warehouseIntake ? (
            <div className="space-y-2">
              <Label>Opening branch stock</Label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Stays 0. Warehouse quantity is added when you save the supplier purchase.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                step="1"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                disabled={!!productId}
                required={!productId}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="low">Low Stock Alert</Label>
            <Input
              id="low"
              type="number"
              min="0"
              step="1"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as "active" | "inactive")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">In Stock</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border-border space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="tracks-expiry">Track expiry dates</Label>
              <p className="text-muted-foreground text-xs">
                Receive stock in dated lots. Sales use the soonest expiry first.
              </p>
            </div>
            <Switch id="tracks-expiry" checked={tracksExpiry} onCheckedChange={setTracksExpiry} />
          </div>
          {tracksExpiry ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="alert-days">Alert days before expiry</Label>
                <Input
                  id="alert-days"
                  type="number"
                  min="0"
                  step="1"
                  value={expiryAlertDays}
                  onChange={(e) => setExpiryAlertDays(e.target.value)}
                  required
                />
              </div>
              {(!productId && Number(stockQuantity) > 0) ||
              (productId?.startsWith("local_") && (initialProduct?.stockQuantity ?? 0) > 0) ||
              (productId &&
                initialProduct &&
                !initialProduct.tracksExpiry &&
                initialProduct.stockQuantity > 0) ? (
                <div className="space-y-2">
                  <Label htmlFor="opening-expiry">
                    {productId && !productId.startsWith("local_")
                      ? "Opening expiry date"
                      : "Expiry date"}
                  </Label>
                  <Input
                    id="opening-expiry"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    required
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
      </div>
      <div className="space-y-3">
        <Label>Product Image</Label>
        <div className="border-border bg-muted/30 relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-4 text-center">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={name || "Product preview"}
              fill
              className="object-cover"
              sizes="320px"
              unoptimized
            />
          ) : productId ? (
            <ProductImage
              productId={productId}
              remoteUrl={initialProduct?.imageUrl}
              alt={name || "Product preview"}
              sizes="320px"
              fallback={
                <>
                  <ImagePlus className="text-muted-foreground mb-2 h-8 w-8" />
                  <p className="text-sm font-medium">Add a product photo</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    JPG, PNG, or WebP · compressed for offline sync · max 2 MB
                  </p>
                </>
              }
            />
          ) : (
            <>
              <ImagePlus className="text-muted-foreground mb-2 h-8 w-8" />
              <p className="text-sm font-medium">Add a product photo</p>
              <p className="text-muted-foreground mt-1 text-xs">
                JPG, PNG, or WebP · compressed for offline sync · max 2 MB
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <label htmlFor="image" className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Upload Image
            </label>
          </Button>
          <Button type="button" variant="outline" onClick={() => void onTakePhoto()}>
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
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
        </div>
        {file ? <p className="text-muted-foreground truncate text-xs">{file.name}</p> : null}
        <TakeProductPhotoDialog
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(captured) => {
            void applyImageFile(captured);
          }}
        />
      </div>
      <DialogFooter className="md:col-span-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save Product"}
        </Button>
      </DialogFooter>
    </form>
  );
}
