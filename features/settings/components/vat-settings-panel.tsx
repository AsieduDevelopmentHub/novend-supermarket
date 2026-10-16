"use client";

import { FormEvent, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NumericInputWithKeypad } from "@/components/ui/touch-numpad";
import type { VatPricingMode } from "@/convex/shared/vatInclusive";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import {
  loadMilliesVatSettings,
  saveMilliesVatSettings,
} from "@/lib/offline/millies-vat-settings";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

/**
 * VAT rate for Millie's till. Choose inclusive (VAT in shelf prices) or exclusive
 * (VAT added at checkout).
 */
export function VatSettingsPanel() {
  const { hasCapability } = useBusinessCapabilities();
  const enabled = hasCapability("tax_vat");
  const [rate, setRate] = useState("15");
  const [label, setLabel] = useState("VAT");
  const [pricingMode, setPricingMode] = useState<VatPricingMode>("inclusive");
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
      setPricingMode(settings.pricingMode === "exclusive" ? "exclusive" : "inclusive");
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
            Enable “VAT / tax on receipts” under Selling & catalog options, then set the rate and
            whether prices are inclusive or exclusive here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await saveMilliesVatSettings({ ratePercent: Number(rate), label, pricingMode });
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
          Configure the VAT percentage and whether selling prices include tax. Confirm compliance
          with your accountant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <p className="text-muted-foreground text-sm">Loading VAT settings…</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <fieldset className="space-y-2">
              <legend className="text-sm leading-none font-medium">Price mode</legend>
              <RadioGroup
                value={pricingMode}
                onValueChange={(value) => setPricingMode(value as VatPricingMode)}
                className="gap-3"
              >
                <label className="border-border flex cursor-pointer gap-3 rounded-lg border p-3">
                  <RadioGroupItem value="inclusive" id="millies-vat-inclusive" className="mt-0.5" />
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">Inclusive</span>
                    <span className="text-muted-foreground block text-xs">
                      Shelf prices already include VAT. Customer pays the marked price; the receipt
                      shows net, VAT, and total.
                    </span>
                  </span>
                </label>
                <label className="border-border flex cursor-pointer gap-3 rounded-lg border p-3">
                  <RadioGroupItem value="exclusive" id="millies-vat-exclusive" className="mt-0.5" />
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">Exclusive</span>
                    <span className="text-muted-foreground block text-xs">
                      Shelf prices are before VAT. VAT is added at checkout so the customer pays net
                      + VAT.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </fieldset>
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
