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
import { withTimeout } from "@/lib/async/with-timeout";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { AppearancePanel } from "./appearance-panel";
import { SecurityPanel } from "./security-panel";
import { PrivacyDataPanel } from "./privacy-data-panel";
import { BranchReceiptPanel } from "./branch-receipt-panel";
import { ProfilePanel } from "./profile-panel";
import { BusinessCapabilitiesPanel } from "./business-capabilities-panel";
import { PrinterPanel } from "./printer-panel";
import { CustomerDisplayPanel } from "./customer-display-panel";
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
  Tv,
  UserRound,
  Wrench,
  Camera,
  CircleHelp,
} from "lucide-react";
import { BillingPanel } from "@/features/billing/components/billing-panel";
import { DevicesPanel } from "@/features/billing/components/devices-panel";
import { HelpToursPanel } from "./help-tours-panel";
import { ReceiptDesignerLayout } from "./receipt-designer-layout";
import {
  buildSettingsSections,
  groupSettingsSections,
  HARDWARE_TABS,
  type SettingsSectionIconMap,
  type SettingsTab,
} from "./settings-section-groups";
import { SettingsMobileSectionNav } from "./settings-mobile-section-nav";

export function SettingsView() {
  const { isAdmin, isManager, isLoading: permissionsLoading } = usePermissions();
  const online = useConnectivity();
  const isDesktop = useDesktopRuntime();
  const isMobileCap = useNativeShell();
  const remoteBusiness = useQuery(api.settings.getBusiness, online && isAdmin ? {} : "skip");
  const remoteTemplate = useQuery(api.settings.getReceiptTemplate, online && isAdmin ? {} : "skip");
  const [cachedPrint, setCachedPrint] = useState<{
    business: ReceiptBusiness;
    template: ReceiptTemplateConfig;
  } | null>(null);
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const requestedSection = useSearchParams().get("section");

  function selectSettingsTab(value: SettingsTab) {
    setTab(value);
  }

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

  // Desktop-only terminal hardware never appears in the Capacitor shell.
  const sections = useMemo(
    () =>
      buildSettingsSections({
        isAdmin,
        isManager,
        isDesktop,
        isMobileCap,
      }),
    [isAdmin, isManager, isDesktop, isMobileCap],
  );

  const sectionGroups = useMemo(() => groupSettingsSections(sections), [sections]);

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
        description={
          isMobileCap
            ? "Browse the sections below — only options that work on this phone are shown."
            : "Choose a section. On smaller screens, use the grouped list to browse every area."
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => selectSettingsTab(value as SettingsTab)}
        className="flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <SettingsTreeNav
          groups={sectionGroups}
          activeTab={activeTab}
          onSelect={selectSettingsTab}
        />
        <div className="min-w-0 flex-1 space-y-4">
          <SettingsMobileSectionNav
            groups={sectionGroups}
            activeTab={activeTab}
            icons={SETTINGS_ICONS}
            onSelect={selectSettingsTab}
          />

          <div className="space-y-4">
            <TabsContent value="profile" className="mt-0">
              <ProfilePanel />
            </TabsContent>

            {isAdmin && business && template ? (
              <>
                <TabsContent value="business" className="mt-0 space-y-4">
                  <BusinessForm
                    key={JSON.stringify(business)}
                    initial={business}
                    readOnly={!online}
                  />
                  <BusinessCapabilitiesPanel />
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
              <>
                <TabsContent value="business" className="mt-0">
                  <Card>
                    <CardContent className="text-muted-foreground p-5 text-sm">
                      Business and receipt settings haven&apos;t been cached on this device yet.
                      Open Settings once while online to keep them available offline.
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="receipt" className="mt-0">
                  <Card>
                    <CardContent className="text-muted-foreground p-5 text-sm">
                      Receipt template settings haven&apos;t been cached on this device yet. Open
                      Settings once while online to review them offline.
                    </CardContent>
                  </Card>
                </TabsContent>
              </>
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
            ) : isMobileCap ? (
              <TabsContent value="mobileHardware" className="mt-0">
                <MobileHardwarePanel />
              </TabsContent>
            ) : (
              <TabsContent value="desktop" className="mt-0">
                <DesktopDownloadPanel />
              </TabsContent>
            )}

            {!isMobileCap ? (
              <TabsContent value="scanner" className="mt-0">
                <ScannerPanel />
              </TabsContent>
            ) : null}

            {sections.some((section) => section.value === "customerDisplay") ? (
              <TabsContent value="customerDisplay" className="mt-0">
                <CustomerDisplayPanel />
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
        </div>
      </Tabs>
    </div>
  );
}

const SETTINGS_ICONS: SettingsSectionIconMap = {
  profile: UserRound,
  receipt: Receipt,
  business: Store,
  billing: CreditCard,
  devices: MonitorSmartphone,
  branchReceipt: Store,
  printer: Monitor,
  customerDisplay: Tv,
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

function SettingsTreeNav({
  groups,
  activeTab,
  onSelect,
}: {
  groups: ReturnType<typeof groupSettingsSections>;
  activeTab: SettingsTab;
  onSelect: (value: SettingsTab) => void;
}) {
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
      await withTimeout(
        updateBusiness({ tradeName, legalName, address, phone, email, taxId }),
        12_000,
        "Save timed out — check your connection and try again",
      );
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
      await withTimeout(
        updateTemplate({
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
        12_000,
        "Save timed out — check your connection and try again",
      );
      toast.success("Receipt template saved");
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <ReceiptDesignerLayout
      previewLabel="Live preview"
      preview={
        <ReceiptDocument
          preview
          payload={SAMPLE_RECEIPT_PAYLOAD}
          templateOverride={previewTemplate}
          businessOverride={initialBusiness}
        />
      }
      form={
        <Card className="flex min-w-0 flex-col lg:h-full">
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
      }
    />
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
