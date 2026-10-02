"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useExpiryPolicy } from "@/hooks/use-expiry-policy";
import { saveExpiryPolicyCache } from "@/lib/offline/expiry-policy";
import { useEffect, useState } from "react";
import { MAX_EXPIRY_ALERT_DAYS, MIN_EXPIRY_ALERT_DAYS } from "@/convex/shared/expiryPolicy";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";

/**
 * Org-admin default for FEFO “expiring soon” windows.
 * Individual products may override in Add / Edit Product.
 */
export function ExpiryAlertSettingsCard() {
  const online = useConnectivity();
  const { hasCapability } = useBusinessCapabilities();
  const policy = useExpiryPolicy();
  const update = useMutation(api.settings.updateExpiryPolicy);
  const [days, setDays] = useState(String(policy.defaultAlertDays));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setDays(String(policy.defaultAlertDays));
  }, [policy.defaultAlertDays]);

  if (!hasCapability("lot_expiry")) return null;

  async function onSave() {
    if (!online) {
      toast.message("Reconnect to change expiry alert settings");
      return;
    }
    const parsed = Number(days);
    if (
      !Number.isFinite(parsed) ||
      parsed < MIN_EXPIRY_ALERT_DAYS ||
      parsed > MAX_EXPIRY_ALERT_DAYS
    ) {
      toast.error(`Enter alert days between ${MIN_EXPIRY_ALERT_DAYS} and ${MAX_EXPIRY_ALERT_DAYS}`);
      return;
    }
    setPending(true);
    try {
      const next = await update({ defaultAlertDays: Math.floor(parsed) });
      await saveExpiryPolicyCache(next);
      toast.success("Default expiry alert updated");
    } catch (error) {
      showError(error, "Could not update expiry alert setting");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="rounded-[20px]">
      <CardHeader className="space-y-1.5">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" aria-hidden />
          Expiry alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Default days before expiry to flag stock as expiring soon. Products can still set their
          own alert window.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="org-expiry-alert-days">Default alert days</Label>
            <Input
              id="org-expiry-alert-days"
              type="number"
              min={MIN_EXPIRY_ALERT_DAYS}
              max={MAX_EXPIRY_ALERT_DAYS}
              step="1"
              className="min-h-11"
              value={days}
              disabled={pending || !online}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="min-h-11 sm:w-auto"
            disabled={pending || !online}
            onClick={() => void onSave()}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
