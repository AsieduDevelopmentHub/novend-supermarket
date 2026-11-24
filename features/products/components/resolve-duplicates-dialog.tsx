"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { showError } from "@/lib/errors";
import {
  findDuplicateProductGroups,
  queueMergeProducts,
  type DuplicateProductGroup,
} from "@/lib/offline/product-merge";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ResolveDuplicatesDialog({ open, onOpenChange }: Props) {
  const [groups, setGroups] = useState<DuplicateProductGroup[] | null>(null);
  const [keeperId, setKeeperId] = useState<string>("");
  const [loserIds, setLoserIds] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGroups(null);
    void findDuplicateProductGroups().then((rows) => {
      if (cancelled) return;
      setGroups(rows);
      const first = rows[0];
      if (first) {
        setSelectedKey(first.key);
        setKeeperId(first.products[0]?.id ?? "");
        setLoserIds(first.products.slice(1).map((p) => p.id));
      } else {
        setSelectedKey("");
        setKeeperId("");
        setLoserIds([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selected = groups?.find((g) => g.key === selectedKey) ?? null;

  function selectGroup(group: DuplicateProductGroup) {
    setSelectedKey(group.key);
    setKeeperId(group.products[0]?.id ?? "");
    setLoserIds(group.products.slice(1).map((p) => p.id));
  }

  async function onMerge() {
    if (!keeperId || loserIds.length === 0) {
      toast.error("Pick one product to keep and at least one to merge away");
      return;
    }
    setPending(true);
    try {
      await queueMergeProducts({ keeperId, loserIds });
      toast.success("Duplicates merged — extras archived");
      const rows = await findDuplicateProductGroups();
      setGroups(rows);
      if (rows[0]) selectGroup(rows[0]);
      else onOpenChange(false);
    } catch (error) {
      showError(error, "Merge failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resolve duplicates</DialogTitle>
          <DialogDescription>
            Keep one product, move its stock from the extras, then archive the extras. Past
            receipts keep their original names.
          </DialogDescription>
        </DialogHeader>

        {groups === null ? (
          <LoadingState label="Scanning catalog…" />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No duplicates found"
            description="No matching barcodes, SKUs, or exact names among active products."
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Duplicate groups</Label>
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                {groups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedKey === group.key ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => selectGroup(group)}
                  >
                    <Badge variant="secondary" className="mr-2 capitalize">
                      {group.reason}
                    </Badge>
                    {group.products.map((p) => p.name).join(" · ")}
                  </button>
                ))}
              </div>
            </div>

            {selected ? (
              <div className="space-y-2">
                <Label>Keep this product</Label>
                <div className="space-y-2">
                  {selected.products.map((product) => {
                    const isKeeper = product.id === keeperId;
                    return (
                      <label
                        key={product.id}
                        className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
                      >
                        <input
                          type="radio"
                          name="keeper"
                          checked={isKeeper}
                          onChange={() => {
                            setKeeperId(product.id);
                            setLoserIds(
                              selected.products.filter((p) => p.id !== product.id).map((p) => p.id),
                            );
                          }}
                        />
                        <span>
                          <span className="font-medium">{product.name}</span>
                          <span className="text-muted-foreground block text-xs">
                            SKU {product.sku}
                            {product.barcode ? ` · ${product.barcode}` : ""} · stock{" "}
                            {product.sellableQuantity ?? product.stockQuantity}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={pending || !selected || !keeperId || loserIds.length === 0}
            onClick={() => void onMerge()}
          >
            Merge into kept product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
