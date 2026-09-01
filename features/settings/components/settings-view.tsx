"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePermissions } from "@/hooks/use-permissions";
import { usePosPreferences } from "@/hooks/use-pos-preferences";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import { useNativeShell } from "@/hooks/use-native-shell";
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import { SAMPLE_RECEIPT_PAYLOAD } from "@/features/receipts/types";
import type { ReceiptBusiness, ReceiptTemplateConfig } from "@/features/receipts/types";
import { loadPrintSnapshotMeta } from "@/lib/offline/ui-cache";
import { savePosPreferences } from "@/lib/offline/pos-preferences";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { AppearancePanel } from "./appearance-panel";
import { SecurityPanel } from "./security-panel";
import { PrivacyDataPanel } from "./privacy-data-panel";
import { BranchReceiptPanel } from "./branch-receipt-panel";
import { ProfilePanel } from "./profile-panel";
import { PrinterPanel } from "./printer-panel";
import { ScannerPanel } from "./scanner-panel";
import { MobileHardwarePanel } from "./mobile-hardware-panel";
import { FutureDevicesPanel } from "./future-devices-panel";
import { UpdatesPanel } from "./updates-panel";
import { DesktopDownloadPanel } from "./desktop-download-panel";
import { BackupsPanel } from "./backups-panel";
import { ReceiptPrintModePicker } from "./receipt-print-mode-picker";
import { resolveReceiptPrintMode, sanitizeReceiptCopy } from "@/lib/receipt-print-mode";
import {
  CreditCard,
  Download,
  Monitor,
  MonitorSmartphone,
  Palette,
  Receipt,
  ScanBarcode,
  Shield,
  ShieldCheck,
  Store,
  UserRound,
  Wrench,
  Camera,
  CircleHelp,
} from "lucide-react";
import { BillingPanel } from "@/features/billing/components/billing-panel";
import { DevicesPanel } from "@/features/billing/components/devices-panel";
import { HelpToursPanel } from "./help-tours-panel";

type SettingsTab =
  | "profile"
  | "receipt"
  | "business"
  | "billing"
  | "devices"
  | "branchReceipt"
  | "printer"
  | "scanner"
  | "mobileHardware"
  | "futureDevices"
  | "updates"
  | "desktop"
  | "backup"
  | "appearance"
  | "security"
  | "privacy"
  | "help";

export function SettingsView() {
  const { isAdmin, isManager, isLoading: permissionsLoading } = usePermissions();
  const online = useConnectivity();
  const isDesktop = useDesktopRuntime();
  const onMobileShell = useNativeShell();
  const remoteBusiness = useQuery(api.settings.getBusiness, online && isAdmin ? {} : "skip");
  const remoteTemplate = useQuery(api.settings.getReceiptTemplate, online && isAdmin ? {} : "skip");
  const [cachedPrint, setCachedPrint] = useState<{
    business: ReceiptBusiness;
    template: ReceiptTemplateConfig;
  } | null>(null);
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const requestedSection = useSearchParams().get("section");

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
              { value: "billing" as const, label: "Billing", long: "Billing & plan" },
            ] as const)
          : []),
        ...(isManager || isAdmin
          ? ([
              { value: "branchReceipt" as const, label: "Branch", long: "Branch receipt" },
              { value: "devices" as const, label: "Devices", long: "Activated devices" },
            ] as const)
          : []),
        ...(isDesktop
          ? ([
              { value: "printer" as const, label: "Printer", long: "Printer" },
              { value: "scanner" as const, label: "Scanner", long: "Barcode scanner" },
              {
                value: "futureDevices" as const,
                label: "Future",
                long: "Future devices",
              },
              { value: "updates" as const, label: "Updates", long: "Desktop updates" },
              { value: "desktop" as const, label: "Downloads", long: "Download apps" },
            ] as const)
          : onMobileShell
            ? ([
                {
                  value: "mobileHardware" as const,
                  label: "Hardware",
                  long: "Camera, photos & sharing",
                },
              ] as const)
            : ([
                { value: "scanner" as const, label: "Scanner", long: "Barcode scanner" },
                { value: "desktop" as const, label: "Downloads", long: "Download apps" },
              ] as const)),
        { value: "backup" as const, label: "Backups", long: "Backups" },
        { value: "appearance" as const, label: "Appearance", long: "Appearance" },
        { value: "security" as const, label: "Security", long: "Security" },
        { value: "privacy" as const, label: "Privacy", long: "Privacy & data" },
        { value: "help" as const, label: "Help", long: "Help & tours" },
      ] as const,
    [isAdmin, isManager, isDesktop, onMobileShell],
  );

  // Banners and limit prompts deep-link here with `?section=billing|devices`.
  const linkedTab = sections.find((section) => section.value === requestedSection)?.value ?? null;
  const activeTab: SettingsTab =
    tab && sections.some((s) => s.value === tab) ? tab : (linkedTab ?? "profile");

  if (permissionsLoading) {
    return <LoadingState label="Loading settings…" variant="form" />;
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      <PageHeader
        title="Settings"
        description="Choose a section. Receipt printing for the whole business lives under Receipt."
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setTab(value as SettingsTab)}
        className="flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <SettingsTreeNav
          sections={sections}
          activeTab={activeTab}
          onSelect={(value) => setTab(value)}
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="lg:hidden" data-tour="settings-sections">
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

          <TabsContent value="profile" className="mt-0">
            <ProfilePanel />
          </TabsContent>

          {isAdmin && business && template ? (
            <>
              <TabsContent value="business" className="mt-0">
                <BusinessForm
                  key={JSON.stringify(business)}
                  initial={business}
                  readOnly={!online}
                />
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

          {isAdmin ? (
            <TabsContent value="billing" className="mt-0">
              <BillingPanel />
            </TabsContent>
          ) : null}

          {isManager || isAdmin ? (
            <>
              <TabsContent value="branchReceipt" className="mt-0">
                <BranchReceiptPanel />
              </TabsContent>
              <TabsContent value="devices" className="mt-0">
                <DevicesPanel />
              </TabsContent>
            </>
          ) : null}

          {isDesktop ? (
            <>
              <TabsContent value="printer" className="mt-0">
                <PrinterPanel />
              </TabsContent>
              <TabsContent value="futureDevices" className="mt-0">
                <FutureDevicesPanel />
              </TabsContent>
              <TabsContent value="updates" className="mt-0">
                <UpdatesPanel />
              </TabsContent>
              <TabsContent value="desktop" className="mt-0">
                <DesktopDownloadPanel />
              </TabsContent>
            </>
          ) : onMobileShell ? (
            <TabsContent value="mobileHardware" className="mt-0">
              <MobileHardwarePanel />
            </TabsContent>
          ) : (
            <TabsContent value="desktop" className="mt-0">
              <DesktopDownloadPanel />
            </TabsContent>
          )}

          {!onMobileShell ? (
            <TabsContent value="scanner" className="mt-0">
              <ScannerPanel />
            </TabsContent>
          ) : null}

          <TabsContent value="backup" className="mt-0">
            <BackupsPanel />
          </TabsContent>

          <TabsContent value="appearance" className="mt-0">
            <AppearancePanel />
          </TabsContent>

          <TabsContent value="security" className="mt-0">
            <SecurityPanel />
          </TabsContent>

          <TabsContent value="privacy" className="mt-0">
            <PrivacyDataPanel />
          </TabsContent>

          <TabsContent value="help" className="mt-0">
            <HelpToursPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

const SETTINGS_ICONS: Record<SettingsTab, typeof UserRound> = {
  profile: UserRound,
  receipt: Receipt,
  business: Store,
  billing: CreditCard,
  devices: MonitorSmartphone,
  branchReceipt: Store,
  printer: Monitor,
  scanner: ScanBarcode,
  mobileHardware: Camera,
  futureDevices: Wrench,
  updates: Download,
  desktop: Download,
  backup: Download,
  appearance: Palette,
  security: Shield,
  privacy: ShieldCheck,
  help: CircleHelp,
};

const HARDWARE_TABS: SettingsTab[] = ["printer", "scanner", "mobileHardware", "futureDevices"];

function SettingsTreeNav({
  sections,
  activeTab,
  onSelect,
}: {
  sections: ReadonlyArray<{ value: SettingsTab; label: string; long: string }>;
  activeTab: SettingsTab;
  onSelect: (value: SettingsTab) => void;
}) {
  const hardwareItems = sections.filter((item) => HARDWARE_TABS.includes(item.value));
  const groups = [
    {
      label: "Account",
      items: sections.filter(
        (item) =>
          item.value === "profile" ||
          item.value === "appearance" ||
          item.value === "security" ||
          item.value === "privacy" ||
          item.value === "help",
      ),
    },
    {
      label: "Business",
      items: sections.filter(
        (item) => item.value === "business" || item.value === "receipt" || item.value === "billing",
      ),
    },
    {
      label: "Branch",
      items: sections.filter((item) => item.value === "branchReceipt"),
    },
    {
      label: "Devices",
      items: sections.filter((item) => item.value === "devices"),
    },
    {
      label: "Hardware",
      items: hardwareItems,
    },
    {
      label: "This device",
      items: sections.filter(
        (item) => item.value === "updates" || item.value === "desktop" || item.value === "backup",
      ),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <nav data-tour="settings-sections" className="border-border hidden w-56 shrink-0 lg:block">
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-muted-foreground mb-2 px-2 text-xs font-semibold tracking-wider uppercase">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = SETTINGS_ICONS[item.value];
                const active = activeTab === item.value;
                const nested = HARDWARE_TABS.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onSelect(item.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium",
                      nested && "pl-4",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.long}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
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
            {readOnly ? "Can't save offline" : pending ? "Saving…" : "Save business profile"}
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
  const posPrefs = usePosPreferences();
  const updatePos = useMutation(api.settings.updatePosPreferences);
  const printMode = resolveReceiptPrintMode(posPrefs);
  const [headerText, setHeaderText] = useState(sanitizeReceiptCopy(initialTemplate.headerText, ""));
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
              <Label htmlFor="receipt-tagline">Header text</Label>
              <Input
                id="receipt-tagline"
                name="receipt-tagline"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                placeholder="Smart POS. Strong business."
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                disabled={readOnly}
              />
              <p className="text-muted-foreground text-xs">
                Tagline under the business name. Not a website URL.
              </p>
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

            <ReceiptPrintModePicker
              value={printMode}
              disabled={readOnly}
              onChange={(mode) => {
                if (!readOnly) {
                  void updatePos({ receiptPrintMode: mode })
                    .then(() =>
                      savePosPreferences({
                        autoPrintReceipt: mode === "automatic",
                        receiptPrintMode: mode,
                      }),
                    )
                    .catch((error) => showError(error, "Could not save print setting"));
                }
              }}
            />

            <div className="grid gap-3 sm:grid-cols-2">
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
              {readOnly ? "Can't save offline" : pending ? "Saving…" : "Save receipt template"}
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
