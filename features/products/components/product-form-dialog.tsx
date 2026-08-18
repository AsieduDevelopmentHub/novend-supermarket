"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { assertValidImageFile, IMAGE_ACCEPT } from "@/lib/uploads/image";
import { ImagePlus } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: Id<"products"> | null;
};

type ProductDetails = {
  _id: Id<"products">;
  _creationTime: number;
  name: string;
  sku: string;
  categoryId: Id<"categories">;
  sellingPrice: number;
  costPrice?: number;
  stockQuantity: number;
  unit: string;
  lowStockThreshold: number;
  tracksExpiry?: boolean;
  expiryAlertDays?: number;
  status: "active" | "inactive" | "archived";
  description?: string;
  imageUrl?: string | null;
};

export function ProductFormDialog({ open, onOpenChange, productId }: Props) {
  const categories = useQuery(api.categories.list, open ? {} : "skip");
  const product = useQuery(api.products.getProduct, open && productId ? { id: productId } : "skip");

  const ready = open && categories !== undefined && (!productId || product !== undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{productId ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        {!ready ? (
          <LoadingState label="Loading form…" />
        ) : (
          <ProductFormBody
            key={`${productId ?? "new"}-${product?._creationTime ?? "create"}`}
            productId={productId}
            initialProduct={(product as ProductDetails | null) ?? null}
            categories={categories ?? []}
            initialCategoryId={
              ((product as ProductDetails | null)?.categoryId as string | undefined) ??
              categories?.[0]?._id ??
              ""
            }
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductFormBody({
  productId,
  initialProduct,
  categories,
  initialCategoryId,
  onOpenChange,
}: {
  productId: Id<"products"> | null;
  initialProduct: ProductDetails | null;
  categories: Array<{ _id: Id<"categories">; name: string }>;
  initialCategoryId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const createProduct = useMutation(api.products.createProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const createCategory = useMutation(api.categories.create);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);

  const [name, setName] = useState(initialProduct?.name ?? "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [skuTouched, setSkuTouched] = useState(!!initialProduct);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [sellingPrice, setSellingPrice] = useState(String(initialProduct?.sellingPrice ?? 0));
  const [costPrice, setCostPrice] = useState(String(initialProduct?.costPrice ?? 0));
  const [stockQuantity, setStockQuantity] = useState(String(initialProduct?.stockQuantity ?? 0));
  const [unit, setUnit] = useState(initialProduct?.unit ?? "packs");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(initialProduct?.lowStockThreshold ?? 10),
  );
  const [tracksExpiry, setTracksExpiry] = useState(initialProduct?.tracksExpiry === true);
  const [expiryAlertDays, setExpiryAlertDays] = useState(
    String(initialProduct?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS),
  );
  const [expiryDate, setExpiryDate] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">(
    initialProduct?.status === "inactive" ? "inactive" : "active",
  );
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayImage = previewUrl ?? initialProduct?.imageUrl ?? null;

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
      const id = await createCategory({ name: trimmed });
      setCategoryId(id);
      setNewCategory("");
      setShowNewCategory(false);
      toast.success("Category created");
    } catch (error) {
      showError(error, "Could not create category");
    }
  }

  async function uploadImage(): Promise<Id<"_storage"> | undefined> {
    if (!file) return undefined;
    await assertValidImageFile(file);
    const uploadUrl = await generateUploadUrl({});
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!result.ok) throw new Error("Image upload failed");
    const json = (await result.json()) as { storageId: Id<"_storage"> };
    return json.storageId;
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
      const imageStorageId = await uploadImage();
      if (productId) {
        await updateProduct({
          id: productId,
          name,
          sku,
          categoryId: categoryId as Id<"categories">,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          unit,
          lowStockThreshold: Number(lowStockThreshold),
          status,
          description,
          imageStorageId,
          tracksExpiry,
          expiryAlertDays: tracksExpiry ? Number(expiryAlertDays) : undefined,
          openingExpiryDate: tracksExpiry && expiryDate ? expiryDate : undefined,
        });
        toast.success("Product updated");
      } else {
        await createProduct({
          name,
          sku,
          categoryId: categoryId as Id<"categories">,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          stockQuantity: Number(stockQuantity),
          unit,
          lowStockThreshold: Number(lowStockThreshold),
          status,
          description,
          imageStorageId,
          tracksExpiry,
          expiryAlertDays: tracksExpiry ? Number(expiryAlertDays) : undefined,
          expiryDate: tracksExpiry && expiryDate ? expiryDate : undefined,
        });
        toast.success("Product created");
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
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="tracks-expiry">Track expiry dates</Label>
              <p className="text-muted-foreground text-xs">
                Receive stock in dated lots. Sales use the soonest expiry first.
              </p>
            </div>
            <Switch
              id="tracks-expiry"
              checked={tracksExpiry}
              onCheckedChange={setTracksExpiry}
            />
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
              (productId &&
                initialProduct &&
                !initialProduct.tracksExpiry &&
                initialProduct.stockQuantity > 0) ? (
                <div className="space-y-2">
                  <Label htmlFor="opening-expiry">
                    {productId ? "Opening expiry date" : "Expiry date"}
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
      <div className="space-y-2">
        <Label htmlFor="image">Product Image</Label>
        <label
          htmlFor="image"
          className="border-border bg-muted/30 hover:border-primary/50 relative flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-4 text-center transition-colors"
        >
          {displayImage ? (
            <Image
              src={displayImage}
              alt={name || "Product preview"}
              fill
              className="object-cover"
              sizes="320px"
              unoptimized
            />
          ) : (
            <>
              <ImagePlus className="text-muted-foreground mb-2 h-8 w-8" />
              <p className="text-sm font-medium">Click to upload image</p>
              <p className="text-muted-foreground mt-1 text-xs">
                JPG/JPEG, PNG, or WebP · max 2 MB
              </p>
            </>
          )}
          <Input
            id="image"
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              if (!next) {
                setFile(null);
                return;
              }
              void assertValidImageFile(next)
                .then(() => setFile(next))
                .catch((error) => {
                  showError(error, "Invalid image file");
                  e.target.value = "";
                  setFile(null);
                });
            }}
          />
        </label>
        {file ? <p className="text-muted-foreground truncate text-xs">{file.name}</p> : null}
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
