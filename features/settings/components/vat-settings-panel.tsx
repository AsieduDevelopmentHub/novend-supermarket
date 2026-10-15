"use client";

import { FormEvent, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumericInputWithKeypad } from "@/components/ui/touch-numpad";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import {
  loadMilliesVatSettings,
  saveMilliesVatSettings,
} from "@/lib/offline/millies-vat-settings";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

/**
 * VAT rate for Millie's till. Selling prices are VAT-inclusive;
 * configure the percentage (or leave 0) and the label printed on receipts.
 */
export function VatSettingsPanel() {
  const { hasCapability } = useBusinessCapabilities();
  const enabled = hasCapability("tax_vat");
  const [rate, setRate] = useState("15");
  const [label, setLabel] = useState("VAT");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void loadMilliesVatSettings().then((settings) => {
      if (cancelled) return;
      setRate(String(settings.ratePercent));
      setLabel(settings.label);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">VAT on receipts</CardTitle>
          <CardDescription>
            Enable “VAT / tax on receipts” under Selling & catalog options, then set the rate here.
            Selling prices stay VAT-inclusive; receipts show net, VAT, and total.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await saveMilliesVatSettings({ ratePercent: Number(rate), label });
      toast.success("VAT settings saved.");
    } catch (error) {
      showError(error, "Could not save VAT settings.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">VAT on receipts</CardTitle>
        <CardDescription>
          Configure the VAT percentage included in your selling prices (or set 0 if prices are
          tax-free). Receipts print net, VAT, and the gross total. Confirm compliance with your
          accountant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <p className="text-muted-foreground text-sm">Loading VAT settings…</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="vat-rate">Rate (%)</Label>
              <NumericInputWithKeypad
                id="vat-rate"
                value={rate}
                onChange={setRate}
                maxFractionDigits={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat-label">Label on receipt</Label>
              <Input
                id="vat-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={32}
              />
            </div>
            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? "Saving…" : "Save VAT settings"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
