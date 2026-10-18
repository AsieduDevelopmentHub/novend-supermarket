"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BarcodeSearchField } from "@/components/hardware/barcode-search-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { filterProductsByBarcode } from "@/lib/offline/barcode-lookup";
import { isBarcodeScanningEnabled } from "@/services/hardware";
import { toast } from "sonner";

export type ProductPickerItem = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  sellUnits?: Array<{ key: string; barcode?: string | null; active?: boolean }> | null;
};

type Props = {
  products: ProductPickerItem[];
  value: string;
  onValueChange: (id: string) => void;
  onProductResolved?: (product: ProductPickerItem) => void;
  placeholder?: string;
  scanPlaceholder?: string;
  /** When false, HID wedge listening is off (e.g. another field owns scans). */
  enabled?: boolean;
  label?: string;
};

/**
 * Product select with barcode wedge + camera scan to identify and select a row.
 */
export function ProductBarcodePicker({
  products,
  value,
  onValueChange,
  onProductResolved,
  placeholder = "Select product",
  scanPlaceholder = "Scan barcode, or enter manually to select product…",
  enabled = true,
  label = "Product",
}: Props) {
  const [scanValue, setScanValue] = useState("");
  const [ambiguous, setAmbiguous] = useState<{
    code: string;
    matches: ProductPickerItem[];
  } | null>(null);

  function selectProduct(product: ProductPickerItem, code: string) {
    onValueChange(product.id);
    onProductResolved?.(product);
    setScanValue("");
    toast.success(`Selected ${product.name}`, {
      description: code.trim() !== product.sku ? product.sku : undefined,
    });
  }

  function resolveBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;

    const matches = filterProductsByBarcode(products, trimmed);
    if (matches.length === 0) {
      toast.error("Product not found");
      return;
    }
    if (matches.length === 1) {
      selectProduct(matches[0]!, trimmed);
      return;
    }
    setAmbiguous({ code: trimmed, matches });
  }

  useBarcodeScanner(
    (code) => {
      resolveBarcode(code);
    },
    { enabled: enabled && isBarcodeScanningEnabled(), allowInInputs: true },
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <SearchableSelect
        options={products.map((product) => ({
          value: product.id,
          label: `${product.name} (${product.sku})`,
        }))}
        value={value}
        onValueChange={(id) => {
          onValueChange(id);
          const product = products.find((row) => row.id === id);
          if (product) onProductResolved?.(product);
        }}
        placeholder={placeholder}
      />
      <BarcodeSearchField
        value={scanValue}
        onChange={setScanValue}
        onScan={resolveBarcode}
        placeholder={scanPlaceholder}
        listenHid={false}
        className="flex gap-2"
      />

      <Dialog open={ambiguous != null} onOpenChange={(open) => !open && setAmbiguous(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select product</DialogTitle>
          </DialogHeader>
          {ambiguous ? (
            <>
              <p className="text-muted-foreground text-sm">
                Multiple products match barcode{" "}
                <span className="text-foreground font-medium">{ambiguous.code}</span>.
              </p>
              <ul className="border-border max-h-72 divide-y overflow-y-auto rounded-lg border">
                {ambiguous.matches.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="hover:bg-muted flex w-full flex-col px-3 py-3 text-left"
                      onClick={() => {
                        selectProduct(product, ambiguous.code);
                        setAmbiguous(null);
                      }}
                    >
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground text-xs">{product.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAmbiguous(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
