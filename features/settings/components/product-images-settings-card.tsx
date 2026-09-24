"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useProductImagesPolicy } from "@/hooks/use-product-images-policy";
import { saveProductImagesPolicyCache } from "@/lib/offline/product-images-policy";
import { useState } from "react";

/**
 * Org-admin control for product catalog image uploads.
 * Matches Security / Business card density.
 */
export function ProductImagesSettingsCard() {
  const online = useConnectivity();
  const policy = useProductImagesPolicy();
  const update = useMutation(api.settings.updateProductImages);
  const [pending, setPending] = useState(false);

  async function onToggle(enabled: boolean) {
    if (!online) {
      toast.message("Reconnect to change product image settings");
      return;
    }
    setPending(true);
    try {
      const next = await update({ enabled });
      await saveProductImagesPolicyCache(next);
      toast.success(enabled ? "Product image uploads enabled" : "Product image uploads disabled");
    } catch (error) {
      showError(error, "Could not update product images setting");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="rounded-[20px]">
      <CardHeader className="space-y-1.5">
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4" aria-hidden />
          Product images
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="product-images-enabled" className="text-sm font-medium">
            Allow product image uploads
          </Label>
          <Switch
            id="product-images-enabled"
            checked={policy.enabled}
            disabled={pending || !online}
            onCheckedChange={(checked) => void onToggle(checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
