"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { useConnectivity } from "@/hooks/use-connectivity";
import { toast } from "sonner";
import { showError } from "@/lib/errors";

type BranchReceipt = {
  id: Id<"branches">;
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

export function BranchReceiptForm({ branch }: { branch: BranchReceipt }) {
  const online = useConnectivity();
  const updateReceiptProfile = useMutation(api.branches.updateReceiptProfile);
  const orgTemplate = useQuery(api.settings.getReceiptTemplate, online ? {} : "skip");
  const orgBusiness = useQuery(api.settings.getBusiness, online ? {} : "skip");

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

  const effectivePaperWidth: "58" | "80" =
    paperWidthMm ?? (orgTemplate?.paperWidthMm === 58 ? "58" : "80");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await updateReceiptProfile({
        id: branch.id,
        name,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        receiptShowName: showName,
        receiptShowAddress: showAddress,
        receiptShowPhone: showPhone,
        receiptShowEmail: showEmail,
        receiptPaperWidthMm: Number(effectivePaperWidth) as 58 | 80,
      });
      toast.success("Branch receipt details saved");
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  const title = orgBusiness?.tradeName ?? SAMPLE_RECEIPT_PAYLOAD.business.tradeName;
  const headerText = orgTemplate?.headerText ?? SAMPLE_RECEIPT_PAYLOAD.template.headerText;

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
    <div className="grid min-w-0 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_auto]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">Branch receipt · {branch.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <p className="text-muted-foreground text-sm">
              The company title ({title}) stays on every receipt. Update only this branch’s line,
              contact details, and paper size.
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
              <Label htmlFor="branch-receipt-name">Branch name on receipt</Label>
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
                Branch name
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save branch receipt"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-2 2xl:sticky 2xl:top-4 2xl:self-start">
        <p className="text-muted-foreground text-xs">Preview</p>
        <div className="bg-muted/40 flex max-w-full justify-center overflow-x-clip rounded-xl p-3">
          <ReceiptDocument
            payload={SAMPLE_RECEIPT_PAYLOAD}
            businessOverride={previewBusiness}
            templateOverride={previewTemplate}
            preview
          />
        </div>
      </div>
    </div>
  );
}
