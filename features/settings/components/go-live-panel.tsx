"use client";

import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readMilliesSession } from "@/lib/offline/millies-auth";
import { getMilliesSampleDataStatus } from "@/lib/offline/millies-auth-db";
import { milliesGoLive, type MilliesGoLiveMode } from "@/lib/offline/millies-go-live";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

/**
 * Go live for Millie's local till — remove samples or clear operational Dexie data.
 */
export function GoLivePanel() {
  const session = readMilliesSession();
  const [status, setStatus] = useState<"none" | "active" | "cleared" | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<MilliesGoLiveMode>("samples");
  const [confirmSamples, setConfirmSamples] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void getMilliesSampleDataStatus().then(setStatus);
  }, []);

  if (!session || session.role !== "administrator") return null;
  if (status !== "active") return null;

  async function runGoLive() {
    if (!session) return;
    setPending(true);
    try {
      await milliesGoLive({
        mode,
        user: session,
        confirmation: mode === "operations" ? confirmation : undefined,
      });
      toast.success(
        mode === "samples"
          ? "Sample data removed — you’re live"
          : "Operational data cleared — you’re live",
      );
      setStatus("cleared");
      setOpen(false);
      setConfirmSamples(false);
      setConfirmation("");
    } catch (error) {
      showError(error, "Could not go live");
    } finally {
      setPending(false);
    }
  }

  const canSubmit = mode === "samples" ? confirmSamples : confirmation === "CLEAR";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="size-4" aria-hidden />
            Go live
          </CardTitle>
          <CardDescription>
            You’re exploring with sample data. When you’re ready for real stock, go live to remove
            samples or clear all operational data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => setOpen(true)}>
            Go live
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Go live</DialogTitle>
            <DialogDescription>
              Choose what to remove. This cannot be undone. Sample data will not load again on this
              till.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={mode}
            onValueChange={(value) => setMode(value as MilliesGoLiveMode)}
            className="gap-3"
          >
            <label className="border-border flex cursor-pointer gap-3 rounded-lg border p-3">
              <RadioGroupItem value="samples" id="millies-go-live-samples" className="mt-0.5" />
              <span className="space-y-1">
                <span className="block text-sm font-medium">Remove sample data</span>
                <span className="text-muted-foreground block text-xs">
                  Removes only the sample catalogue we loaded. Your own products and sales stay.
                </span>
              </span>
            </label>
            <label className="border-border flex cursor-pointer gap-3 rounded-lg border p-3">
              <RadioGroupItem value="operations" id="millies-go-live-ops" className="mt-0.5" />
              <span className="space-y-1">
                <span className="block text-sm font-medium">Clear all operational data</span>
                <span className="text-muted-foreground block text-xs">
                  Deletes all products, stock, sales, customers, and suppliers. Users and settings
                  stay. This cannot be undone.
                </span>
              </span>
            </label>
          </RadioGroup>

          {mode === "samples" ? (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={confirmSamples}
                onCheckedChange={(checked) => setConfirmSamples(checked === true)}
                className="mt-0.5"
              />
              <span>I understand sample products and sales will be permanently deleted.</span>
            </label>
          ) : (
            <div className="space-y-2">
              <Alert variant="destructive">
                <AlertTitle>Destructive</AlertTitle>
                <AlertDescription>
                  All sales, inventory, customers, and suppliers on this till will be deleted.
                </AlertDescription>
              </Alert>
              <Label htmlFor="millies-go-live-clear">Type CLEAR to confirm</Label>
              <Input
                id="millies-go-live-clear"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                placeholder="CLEAR"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={mode === "operations" ? "destructive" : "default"}
              disabled={!canSubmit || pending}
              onClick={() => void runGoLive()}
            >
              {pending ? "Working…" : "Go live"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
