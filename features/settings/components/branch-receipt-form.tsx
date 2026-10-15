"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import { SAMPLE_RECEIPT_PAYLOAD } from "@/features/receipts/types";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  loadMilliesPrintSnapshot,
  saveMilliesBranchReceipt,
} from "@/lib/offline/millies-print-settings";
import { withTimeout } from "@/lib/async/with-timeout";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { ReceiptDesignerLayout } from "./receipt-designer-layout";

type BranchReceipt = {
  id: Id<"branches"> | string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  receiptShowName: boolean;
  receiptShowAddress: boolean;
  receiptShowPhone: boolean;
  receiptShowEmail: boolean;
  receiptPaperWidthMm: 58 | 80 | null;
};

export function BranchReceiptForm({
  branch,
  onLocalSaved,
}: {
  branch: BranchReceipt;
  onLocalSaved?: () => void;
}) {
  const online = useConnectivity();
  const updateReceiptProfile = useMutation(api.branches.updateReceiptProfile);
  const orgTemplate = useAuthedQuery(
    api.settings.getReceiptTemplate,
    !FULLY_OFFLINE && online ? {} : "skip",
  );
  const orgBusiness = useAuthedQuery(
    api.settings.getBusiness,
    !FULLY_OFFLINE && online ? {} : "skip",
  );
  const [localPrint, setLocalPrint] = useState<{
    tradeName: string;
    headerText: string;
    paperWidthMm: 58 | 80;
  } | null>(null);

  useEffect(() => {
    if (!FULLY_OFFLINE) return;
    let cancelled = false;
    void loadMilliesPrintSnapshot().then((snap) => {
      if (cancelled) return;
      setLocalPrint({
        tradeName: snap.business.tradeName,
        headerText: snap.template.headerText,
        paperWidthMm: snap.template.paperWidthMm === 58 ? 58 : 80,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [name, setName] = useState(branch.name);
  const [address, setAddress] = useState(branch.address ?? "");
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [email, setEmail] = useState(branch.email ?? "");
  const [showName, setShowName] = useState(branch.receiptShowName);
  const [showAddress, setShowAddress] = useState(branch.receiptShowAddress);
  const [showPhone, setShowPhone] = useState(branch.receiptShowPhone);
  const [showEmail, setShowEmail] = useState(branch.receiptShowEmail);
  const [paperWidthMm, setPaperWidthMm] = useState<"58" | "80" | null>(
    branch.receiptPaperWidthMm === 58 ? "58" : branch.receiptPaperWidthMm === 80 ? "80" : null,
  );
  const [pending, setPending] = useState(false);

  const orgPaper =
    orgTemplate?.paperWidthMm === 58
      ? "58"
      : localPrint?.paperWidthMm === 58
        ? "58"
        : "80";
  const effectivePaperWidth: "58" | "80" = paperWidthMm ?? orgPaper;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!FULLY_OFFLINE && !online) {
      toast.message("Reconnect to save branch receipt settings");
      return;
    }
    setPending(true);
    try {
      const paper = Number(effectivePaperWidth) as 58 | 80;
      if (FULLY_OFFLINE) {
        await saveMilliesBranchReceipt({
          id: String(branch.id),
          name,
          address: address || undefined,
          phone: phone || undefined,
          email: email || undefined,
          receiptShowName: showName,
          receiptShowAddress: showAddress,
          receiptShowPhone: showPhone,
          receiptShowEmail: showEmail,
          receiptPaperWidthMm: paper,
        });
        onLocalSaved?.();
        toast.success("Store receipt settings saved");
      } else {
        await withTimeout(
          updateReceiptProfile({
            id: branch.id as Id<"branches">,
            name,
            address: address || undefined,
            phone: phone || undefined,
            email: email || undefined,
            receiptShowName: showName,
            receiptShowAddress: showAddress,
            receiptShowPhone: showPhone,
            receiptShowEmail: showEmail,
            receiptPaperWidthMm: paper,
          }),
          12_000,
          "Save timed out — check your connection and try again",
        );
        toast.success("Branch receipt settings saved");
      }
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  const title =
    orgBusiness?.tradeName ?? localPrint?.tradeName ?? SAMPLE_RECEIPT_PAYLOAD.business.tradeName;
  const headerText =
    orgTemplate?.headerText ?? localPrint?.headerText ?? SAMPLE_RECEIPT_PAYLOAD.template.headerText;

  const previewBusiness = {
    ...SAMPLE_RECEIPT_PAYLOAD.business,
    ...(orgBusiness ?? {}),
    tradeName: title,
    legalName: orgBusiness?.legalName ?? title,
    branchName: showName ? name : undefined,
    address: showAddress ? address : "",
    phone: showPhone ? phone : "",
    email: showEmail ? email : "",
  };

  const previewTemplate = {
    ...SAMPLE_RECEIPT_PAYLOAD.template,
    ...(orgTemplate ?? {}),
    headerText,
    paperWidthMm: Number(effectivePaperWidth) as 58 | 80,
  };

  return (
    <ReceiptDesignerLayout
      previewLabel="Preview"
      preview={
        <ReceiptDocument
          payload={SAMPLE_RECEIPT_PAYLOAD}
          businessOverride={previewBusiness}
          templateOverride={previewTemplate}
          preview
        />
      }
      form={
        <Card className="flex min-w-0 flex-col lg:h-full">
          <CardHeader>
            <CardTitle className="text-base">
              {FULLY_OFFLINE ? "Store receipt" : "Branch receipt"} · {branch.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <p className="text-muted-foreground text-sm">
                {FULLY_OFFLINE
                  ? `The company title (${title}) stays on every receipt. Update store contact details and paper size — saved on this till only.`
                  : `The company title (${title}) stays on every receipt. Update only this branch’s line, contact details, and paper size.`}
              </p>

              <div className="space-y-2">
                <Label>Receipt size</Label>
                <Select
                  value={effectivePaperWidth}
                  onValueChange={(v) => setPaperWidthMm(v as "58" | "80")}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80">80mm (recommended)</SelectItem>
                    <SelectItem value="58">58mm</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Match the OS printer paper size when printing from Sales.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch-receipt-name">
                  {FULLY_OFFLINE ? "Store name on receipt" : "Branch name on receipt"}
                </Label>
                <Input
                  id="branch-receipt-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-receipt-address">Address</Label>
                <Input
                  id="branch-receipt-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-receipt-phone">Phone</Label>
                <Input
                  id="branch-receipt-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-receipt-email">Email (optional)</Label>
                <Input
                  id="branch-receipt-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Show on receipt</p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={showName} onCheckedChange={(v) => setShowName(v === true)} />
                  {FULLY_OFFLINE ? "Store name" : "Branch name"}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={showAddress}
                    onCheckedChange={(v) => setShowAddress(v === true)}
                  />
                  Address
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={showPhone} onCheckedChange={(v) => setShowPhone(v === true)} />
                  Phone
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={showEmail} onCheckedChange={(v) => setShowEmail(v === true)} />
                  Email
                </label>
              </div>
              <Button type="submit" disabled={pending || (!FULLY_OFFLINE && !online)}>
                {pending
                  ? "Saving…"
                  : FULLY_OFFLINE
                    ? "Save store receipt"
                    : "Save branch receipt"}
              </Button>
            </form>
          </CardContent>
        </Card>
      }
    />
  );
}
