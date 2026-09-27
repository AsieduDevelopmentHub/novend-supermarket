"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { ProductImage } from "@/components/media/product-image";

export type BarcodeMatchProduct = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  stockQuantity: number;
  tracksInventory?: boolean;
  imageUrl?: string | null;
};

type Props = {
  open: boolean;
  code: string;
  products: BarcodeMatchProduct[];
  onOpenChange: (open: boolean) => void;
  onSelect: (product: BarcodeMatchProduct) => void;
};

/** Shown when a scanned barcode matches more than one local product. */
export function BarcodeMatchDialog({ open, code, products, onOpenChange, onSelect }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select product</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Multiple products match barcode{" "}
          <span className="text-foreground font-medium">{code}</span>. Choose one to add to the
          cart.
        </p>
        <ul className="border-border max-h-72 divide-y overflow-y-auto rounded-lg border">
          {products.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="hover:bg-muted flex w-full items-center gap-3 px-3 py-3 text-left"
                onClick={() => onSelect(product)}
              >
                <div className="bg-muted relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                  <ProductImage
                    productId={product.id}
                    remoteUrl={product.imageUrl}
                    alt=""
                    sizes="40px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {product.sku} · {formatCurrency(product.sellingPrice)}
                    {product.tracksInventory === false
                      ? null
                      : ` · Stock ${product.stockQuantity}`}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
