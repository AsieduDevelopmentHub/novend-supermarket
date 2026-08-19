"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import { SAMPLE_RECEIPT_PAYLOAD } from "@/features/receipts/types";
import type { ReceiptBusiness, ReceiptTemplateConfig } from "@/features/receipts/types";
import { loadPrintSnapshotMeta } from "@/lib/offline/ui-cache";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { AppearancePanel } from "./appearance-panel";
import { SecurityPanel } from "./security-panel";
import { BranchReceiptPanel } from "./branch-receipt-panel";
import { ProfilePanel } from "./profile-panel";
import { PrinterPanel } from "./printer-panel";
import { UpdatesPanel } from "./updates-panel";
import { DesktopDownloadPanel } from "./desktop-download-panel";

type SettingsTab =
  | "profile"
  | "receipt"
  | "business"
  | "branchReceipt"
  | "printer"
  | "updates"
  | "desktop"
  | "appearance"
  | "security";

export function SettingsView() {
  const { isAdmin, isManager, isLoading: permissionsLoading } = usePermissions();
  const online = useConnectivity();
  const isDesktop = useDesktopRuntime();
  const remoteBusiness = useQuery(api.settings.getBusiness, online && isAdmin ? {} : "skip");
  const remoteTemplate = useQuery(api.settings.getReceiptTemplate, online && isAdmin ? {} : "skip");
  const [cachedPrint, setCachedPrint] = useState<{
    business: ReceiptBusiness;
    template: ReceiptTemplateConfig;
  } | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [tab, setTab] = useState<SettingsTab | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPrintSnapshotMeta().then((snapshot) => {
      if (cancelled) return;
      if (snapshot) {
        setCachedPrint({
          business: {
            tradeName: snapshot.business.tradeName,
            legalName: snapshot.business.legalName,
            address: snapshot.business.address,
            phone: snapshot.business.phone,
            email: snapshot.business.email,
            taxId: snapshot.business.taxId,
          },
          template: {
            paperWidthMm: snapshot.template.paperWidthMm,
            showLogo: snapshot.template.showLogo,
            headerText: snapshot.template.headerText,
            footerText: snapshot.template.footerText,
            thankYouLine: snapshot.template.thankYouLine,
            showCashier: snapshot.template.showCashier,
            showCustomer: snapshot.template.showCustomer,
            showPaymentMethod: snapshot.template.showPaymentMethod,
            showSku: snapshot.template.showSku,
          },
        });
      }
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const business = remoteBusiness ?? cachedPrint?.business ?? null;
  const template = remoteTemplate ?? cachedPrint?.template ?? null;

  // Terminal printer settings only exist on the desktop shell — browsers always
  // print through the operating system dialog and have no hardware to configure.
  const sections = useMemo(
    () =>
      [
        { value: "profile" as const, label: "Profile", long: "Profile" },
        ...(isAdmin
          ? ([
              { value: "receipt" as const, label: "Receipt", long: "Receipt template" },
              { value: "business" as const, label: "Business", long: "Business profile" },
            ] as const)
          : []),
        ...(isManager || isAdmin
          ? ([
              { value: "branchReceipt" as const, label: "Branch", long: "Branch receipt" },
            ] as const)
          : []),
        ...(isDesktop
          ? ([
              { value: "printer" as const, label: "Printer", long: "This terminal’s printer" },
              { value: "updates" as const, label: "Updates", long: "Desktop updates" },
            ] as const)
          : ([
              { value: "desktop" as const, label: "Desktop", long: "Download desktop app" },
            ] as const)),
        { value: "appearance" as const, label: "Appearance", long: "Appearance" },
        { value: "security" as const, label: "Security", long: "Security" },
      ] as const,
    [isAdmin, isManager, isDesktop],
  );

  const activeTab: SettingsTab = tab && sections.some((s) => s.value === tab) ? tab : "profile";

  const waitingAdminRemote =
    online && isAdmin && (remoteBusiness === undefined || remoteTemplate === undefined);
  const waitingAdminCache = !online && isAdmin && !cacheReady;

  if (permissionsLoading || waitingAdminRemote || waitingAdminCache) {
    return <LoadingState label="Loading settings…" variant="form" />;
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      {!online ? (
        <p className="text-muted-foreground border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          You&apos;re offline — browsing cached settings. Profile photo, password, and server saves
          need a connection. Appearance and desktop terminal settings still work on this device.
          Desktop downloads need a connection.
        </p>
      ) : null}
      <PageHeader
        title="Settings"
        description={
          isAdmin
            ? `Profile, business, receipts, ${isDesktop ? "this terminal’s printer, updates, " : "desktop download, "}appearance, and security.`
            : isManager
              ? `Profile, branch receipt, ${isDesktop ? "this terminal’s printer, updates, " : "desktop download, "}appearance, and security.`
              : `Manage your profile, ${isDesktop ? "this terminal’s printer, updates, " : "desktop download, "}appearance, and account security.`
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setTab(value as SettingsTab)}
        className="space-y-4"
      >
        {/* Mobile: dropdown avoids crowded tab strip */}
        <div className="md:hidden">
          <Label htmlFor="settings-section" className="sr-only">
            Settings section
          </Label>
          <Select value={activeTab} onValueChange={(value) => setTab(value as SettingsTab)}>
            <SelectTrigger id="settings-section" className="w-full">
              <SelectValue placeholder="Choose a section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.value} value={section.value}>
                  {section.long}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop / tablet: scrollable tabs that wrap when needed */}
        <div className="hidden md:block">
          <TabsList className="bg-muted/60 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
            {sections.map((section) => (
              <TabsTrigger
                key={section.value}
                value={section.value}
                className="data-[state=active]:bg-card px-3 py-2"
              >
                <span className="lg:hidden">{section.label}</span>
                <span className="hidden lg:inline">{section.long}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-0">
          <ProfilePanel />
        </TabsContent>

        {isAdmin && business && template ? (
          <>
            <TabsContent value="business" className="mt-0">
              <BusinessForm key={JSON.stringify(business)} initial={business} readOnly={!online} />
            </TabsContent>

            <TabsContent value="receipt" className="mt-0">
              <ReceiptTemplateForm
                key={JSON.stringify(template)}
                initialTemplate={template}
                initialBusiness={business}
                readOnly={!online}
              />
            </TabsContent>
          </>
        ) : isAdmin && !online ? (
          <TabsContent value="business" className="mt-0">
            <Card>
              <CardContent className="text-muted-foreground p-5 text-sm">
                Business and receipt settings haven&apos;t been cached on this device yet. Open
                Settings once while online to keep them available offline.
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {isManager || isAdmin ? (
          <TabsContent value="branchReceipt" className="mt-0">
            <BranchReceiptPanel />
          </TabsContent>
        ) : null}

        {isDesktop ? (
          <>
            <TabsContent value="printer" className="mt-0">
              <PrinterPanel />
            </TabsContent>
            <TabsContent value="updates" className="mt-0">
              <UpdatesPanel />
            </TabsContent>
          </>
        ) : (
          <TabsContent value="desktop" className="mt-0">
            <DesktopDownloadPanel />
          </TabsContent>
        )}

        <TabsContent value="appearance" className="mt-0">
          <AppearancePanel />
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <SecurityPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BusinessForm({
  initial,
  readOnly = false,
}: {
  initial: ReceiptBusiness;
  readOnly?: boolean;
}) {
  const updateBusiness = useMutation(api.settings.updateBusiness);
  const [tradeName, setTradeName] = useState(initial.tradeName);
  const [legalName, setLegalName] = useState(initial.legalName);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [taxId, setTaxId] = useState(initial.taxId);
  const [pending, setPending] = useState(false);

  async function onSaveBusiness(event: FormEvent) {
    event.preventDefault();
    if (readOnly) {
      toast.message("Reconnect to save business settings");
      return;
    }
    setPending(true);
    try {
      await updateBusiness({ tradeName, legalName, address, phone, email, taxId });
      toast.success("Business profile saved");
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid max-w-2xl gap-4" onSubmit={onSaveBusiness}>
          <div className="space-y-2">
            <Label htmlFor="tradeName">Trade name</Label>
            <Input
              id="tradeName"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              required
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal name</Label>
            <Input
              id="legalName"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              disabled={readOnly}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">Tax ID / TIN</Label>
            <Input
              id="taxId"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <Button type="submit" disabled={pending || readOnly} className="w-fit">
            {readOnly ? "Read-only offline" : pending ? "Saving…" : "Save business profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ReceiptTemplateForm({
  initialTemplate,
  initialBusiness,
  readOnly = false,
}: {
  initialTemplate: ReceiptTemplateConfig;
  initialBusiness: ReceiptBusiness;
  readOnly?: boolean;
}) {
  const updateTemplate = useMutation(api.settings.updateReceiptTemplate);
  const [paperWidthMm, setPaperWidthMm] = useState(
    String(initialTemplate.paperWidthMm) as "58" | "80",
  );
  const posPrefs = useQuery(api.settings.getPosPreferences, readOnly ? "skip" : {});
  const updatePos = useMutation(api.settings.updatePosPreferences);
  const autoPrintReceipt = posPrefs?.autoPrintReceipt ?? false;
  const [headerText, setHeaderText] = useState(initialTemplate.headerText);
  const [footerText, setFooterText] = useState(initialTemplate.footerText);
  const [thankYouLine, setThankYouLine] = useState(initialTemplate.thankYouLine);
  const [showCashier, setShowCashier] = useState(initialTemplate.showCashier);
  const [showCustomer, setShowCustomer] = useState(initialTemplate.showCustomer);
  const [showPaymentMethod, setShowPaymentMethod] = useState(initialTemplate.showPaymentMethod);
  const [showSku, setShowSku] = useState(initialTemplate.showSku);
  const [pending, setPending] = useState(false);

  const previewTemplate = useMemo<Partial<ReceiptTemplateConfig>>(
    () => ({
      paperWidthMm: Number(paperWidthMm) as 58 | 80,
      showLogo: false,
      headerText,
      footerText,
      thankYouLine,
      showCashier,
      showCustomer,
      showPaymentMethod,
      showSku,
    }),
    [
      paperWidthMm,
      headerText,
      footerText,
      thankYouLine,
      showCashier,
      showCustomer,
      showPaymentMethod,
      showSku,
    ],
  );

  async function onSaveTemplate(event: FormEvent) {
    event.preventDefault();
    if (readOnly) {
      toast.message("Reconnect to save receipt template");
      return;
    }
    setPending(true);
    try {
      await updateTemplate({
        paperWidthMm: Number(paperWidthMm) as 58 | 80,
        showLogo: false,
        headerText,
        footerText,
        thankYouLine,
        showCashier,
        showCustomer,
        showPaymentMethod,
        showSku,
      });
      toast.success("Receipt template saved");
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Receipt template designer</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSaveTemplate}>
            <div className="space-y-2">
              <Label>Paper width</Label>
              <Select
                value={paperWidthMm}
                onValueChange={(v) => setPaperWidthMm(v as "58" | "80")}
                disabled={readOnly}
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
                Affects receipt layout in preview and print. Desktop silent print uses this width
                unless the terminal printer settings override it.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="headerText">Header text</Label>
              <Input
                id="headerText"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="footerText">Footer text</Label>
              <Input
                id="footerText"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thankYou">Thank-you / policy line</Label>
              <Input
                id="thankYou"
                value={thankYouLine}
                onChange={(e) => setThankYouLine(e.target.value)}
                disabled={readOnly}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow
                id="autoPrintReceipt"
                label="Auto-print receipt after sale"
                checked={autoPrintReceipt}
                onChange={(next) => {
                  if (!readOnly) {
                    void updatePos({ autoPrintReceipt: next }).catch((error) =>
                      showError(error, "Could not save print setting"),
                    );
                  }
                }}
                disabled={readOnly}
              />
              <ToggleRow
                id="showCashier"
                label="Show cashier"
                checked={showCashier}
                onChange={setShowCashier}
                disabled={readOnly}
              />
              <ToggleRow
                id="showCustomer"
                label="Show customer"
                checked={showCustomer}
                onChange={setShowCustomer}
                disabled={readOnly}
              />
              <ToggleRow
                id="showPayment"
                label="Show payment method"
                checked={showPaymentMethod}
                onChange={setShowPaymentMethod}
                disabled={readOnly}
              />
              <ToggleRow
                id="showSku"
                label="Show SKU on lines"
                checked={showSku}
                onChange={setShowSku}
                disabled={readOnly}
              />
            </div>

            <Button type="submit" disabled={pending || readOnly}>
              {readOnly ? "Read-only offline" : pending ? "Saving…" : "Save receipt template"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-3">
        <p className="text-sm font-medium">Live preview</p>
        <div className="bg-muted/40 flex max-w-full justify-center overflow-x-clip rounded-xl p-4">
          <ReceiptDocument
            preview
            payload={SAMPLE_RECEIPT_PAYLOAD}
            templateOverride={previewTemplate}
            businessOverride={initialBusiness}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="border-border flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  );
}
