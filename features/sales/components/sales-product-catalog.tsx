"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { ProductImage } from "@/components/media/product-image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogProduct } from "@/hooks/use-offline-catalog";
import { formatCurrency } from "@/lib/currency";
import { listActiveSellUnits } from "@/convex/shared/units";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import {
  productDisplayContainerClass,
  productDisplayGridTemplate,
  productDisplaySupportsColumns,
  productDisplayTileClass,
  SALES_PRODUCT_DISPLAY_COLUMNS,
  SALES_PRODUCT_DISPLAY_MODE_LABELS,
  SALES_PRODUCT_DISPLAY_MODES,
  type SalesProductDisplay,
  type SalesProductDisplayColumns,
  type SalesProductDisplayMode,
} from "@/lib/sales/product-display";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

type SalesProductDisplayControlsProps = {
  display: SalesProductDisplay;
  onDisplayChange: (next: SalesProductDisplay) => void;
  className?: string;
};

/** Compact mode + columns controls for the Sales search toolbar. */
export function SalesProductDisplayControls({
  display,
  onDisplayChange,
  className,
}: SalesProductDisplayControlsProps) {
  const showColumns = productDisplaySupportsColumns(display.mode);

  function setMode(mode: SalesProductDisplayMode) {
    if (!productDisplaySupportsColumns(mode)) {
      onDisplayChange({ mode });
      return;
    }
    onDisplayChange({
      mode,
      columns: display.columns,
    });
  }

  function setColumns(value: string) {
    if (value === "auto") {
      onDisplayChange({ mode: display.mode });
      return;
    }
    const columns = Number(value) as SalesProductDisplayColumns;
    onDisplayChange({ mode: display.mode, columns });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        value={display.mode}
        onValueChange={(value) => setMode(value as SalesProductDisplayMode)}
      >
        <SelectTrigger className="h-10 w-[8.5rem] sm:h-9" aria-label="Product display mode">
          <SelectValue placeholder="View" />
        </SelectTrigger>
        <SelectContent>
          {SALES_PRODUCT_DISPLAY_MODES.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {SALES_PRODUCT_DISPLAY_MODE_LABELS[mode]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showColumns ? (
        <Select
          value={display.columns ? String(display.columns) : "auto"}
          onValueChange={setColumns}
        >
          <SelectTrigger className="h-10 w-[7.5rem] sm:h-9" aria-label="Products per row">
            <SelectValue placeholder="Columns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{display.mode === "dense" ? "Auto (5)" : "Auto"}</SelectItem>
            {SALES_PRODUCT_DISPLAY_COLUMNS.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count} per row
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

type SalesProductCatalogProps = {
  products: CatalogProduct[];
  loading: boolean;
  display: SalesProductDisplay;
  onAddToCart: (product: CatalogProduct) => void;
};

export function SalesProductCatalog({
  products,
  loading,
  display,
  onAddToCart,
}: SalesProductCatalogProps) {
  const gridTemplate = productDisplayGridTemplate(display);
  const { isAdmin, isManager } = usePermissions();
  const canAddProducts = isAdmin || isManager;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">Quick Products</h2>

      {loading ? (
        <LoadingState label="Loading products…" />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description={
            canAddProducts
              ? "Add products to your catalog, then sell them here."
              : "Ask an administrator to add products to the catalog."
          }
          action={
            canAddProducts ? (
              <Button asChild>
                <Link href="/products">Add product</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          data-tour="sales-catalog"
          className={cn(productDisplayContainerClass(display))}
          style={gridTemplate ? { gridTemplateColumns: gridTemplate } : undefined}
        >
          {products.map((product) => (
            <SalesProductTile
              key={product.id}
              product={product}
              display={display}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SalesProductTile({
  product,
  display,
  onAddToCart,
}: {
  product: CatalogProduct;
  display: SalesProductDisplay;
  onAddToCart: (product: CatalogProduct) => void;
}) {
  const isList = display.mode === "list";
  const isIcons = display.mode === "icons";
  const { hasCapability } = useBusinessCapabilities();
  const multiUnitOn = hasCapability("multi_unit_pricing");
  const activeUnits =
    multiUnitOn && product.sellUnits?.length
      ? listActiveSellUnits({
          unit: product.unit,
          sellingPrice: product.sellingPrice,
          costPrice: 0,
          sellUnits: product.sellUnits,
          pricingMode: product.pricingMode,
        })
      : [];
  const unitHint =
    activeUnits.length > 1 ? `${activeUnits.length} units` : product.unit;

  return (
    <button
      type="button"
      onClick={() => onAddToCart(product)}
      className={productDisplayTileClass(display)}
      aria-label={
        activeUnits.length > 1
          ? `${product.name}, choose sell unit`
          : product.name
      }
    >
      {isList ? (
        <>
          <div className="bg-muted relative size-11 shrink-0 overflow-hidden rounded-lg sm:size-12">
            <ProductImage
              productId={product.id}
              remoteUrl={product.imageUrl}
              alt={product.name}
              sizes="48px"
              fallback={
                <Package className="text-muted-foreground absolute inset-0 m-auto h-5 w-5" />
              }
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
              {product.tracksInventory === false
                ? unitHint
                : `Stock ${product.stockQuantity} ${product.unit}`}
              {activeUnits.length > 1 ? ` · ${activeUnits.length} sell units` : null}
              {product.isExpiring ? " · Expiring soon" : null}
            </p>
          </div>
          <p className="text-primary shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(product.sellingPrice)}
          </p>
        </>
      ) : (
        <>
          <div
            className={cn(
              "bg-muted relative overflow-hidden rounded-lg",
              isIcons
                ? "mb-1 aspect-square"
                : display.mode === "cards"
                  ? "mb-3 aspect-[4/3]"
                  : "mb-2 aspect-square sm:mb-3 sm:aspect-[4/3]",
            )}
          >
            <ProductImage
              productId={product.id}
              remoteUrl={product.imageUrl}
              alt={product.name}
              sizes={
                isIcons
                  ? "(max-width: 640px) 20vw, 96px"
                  : display.mode === "dense"
                    ? "(max-width: 640px) 33vw, 140px"
                    : "(max-width: 640px) 50vw, 240px"
              }
              fallback={
                <Package
                  className={cn(
                    "text-muted-foreground absolute inset-0 m-auto",
                    isIcons ? "h-5 w-5" : "h-7 w-7 sm:h-8 sm:w-8",
                  )}
                />
              }
            />
          </div>
          <p
            className={cn(
              "font-medium",
              isIcons ? "truncate text-xs leading-tight" : "line-clamp-2 text-sm leading-tight",
            )}
          >
            {product.name}
          </p>
          <p
            className={cn(
              "text-primary font-semibold",
              isIcons ? "mt-0.5 text-xs tabular-nums" : "mt-1 text-sm",
            )}
          >
            {formatCurrency(product.sellingPrice)}
          </p>
          {!isIcons ? (
            <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
              {product.tracksInventory === false
                ? product.unit
                : `Stock ${product.stockQuantity} ${product.unit}`}
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 truncate text-[10px] leading-tight tabular-nums">
              {product.tracksInventory === false
                ? product.unit
                : `${product.stockQuantity} ${product.unit}`}
            </p>
          )}
          {product.isExpiring && !isIcons ? (
            <Badge variant="warning" className="mt-1 sm:mt-2">
              Expiring soon
            </Badge>
          ) : null}
        </>
      )}
    </button>
  );
}
