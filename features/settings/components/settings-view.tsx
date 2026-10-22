"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { FULLY_OFFLINE } from "@/constants/runtime";
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
import { replaceClientShellUrl } from "@/lib/navigation/client-shell-url";
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import { SAMPLE_RECEIPT_PAYLOAD } from "@/features/receipts/types";
import type { ReceiptBusiness, ReceiptTemplateConfig } from "@/features/receipts/types";
import { loadPrintSnapshotMeta } from "@/lib/offline/ui-cache";
import {
  DEFAULT_MILLIES_BUSINESS,
  DEFAULT_MILLIES_TEMPLATE,
  loadMilliesPrintSnapshot,
  saveMilliesBusiness,
  saveMilliesReceiptTemplate,
} from "@/lib/offline/millies-print-settings";
import { savePosPreferences } from "@/lib/offline/pos-preferences";
import { withTimeout } from "@/lib/async/with-timeout";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { AppearancePanel } from "./appearance-panel";
import { SecurityPanel } from "./security-panel";
import { PrivacyDataPanel } from "./privacy-data-panel";
import { GoLivePanel } from "./go-live-panel";
import { BranchReceiptPanel } from "./branch-receipt-panel";
import { ProfilePanel } from "./profile-panel";
import { BusinessCapabilitiesPanel } from "./business-capabilities-panel";
import { VatSettingsPanel } from "./vat-settings-panel";
import { ProductImagesSettingsCard } from "./product-images-settings-card";
import { ExpiryAlertSettingsCard } from "./expiry-alert-settings-card";
import { PrinterPanel } from "./printer-panel";
import { CustomerDisplayPanel } from "./customer-display-panel";
import { ScannerPanel } from "./scanner-panel";
import { MobileHardwarePanel } from "./mobile-hardware-panel";
import { FutureDevicesPanel } from "./future-devices-panel";
import { UpdatesPanel } from "./updates-panel";
import { DesktopDownloadPanel } from "./desktop-download-panel";
import { BackupsPanel } from "./backups-panel";
import { MilliesLicensePanel } from "./millies-license-panel";
import { ReceiptPrintModePicker } from "./receipt-print-mode-picker";
import { resolveReceiptPrintMode, sanitizeReceiptCopy } from "@/lib/receipt-print-mode";
import {
  CreditCard,
  Download,
  KeyRound,
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
import { useLicense } from "@/hooks/use-license";
import { isBillingHidden } from "@/config/navigation";
import { AccessDenied } from "@/components/feedback/access-denied";

export function SettingsView() {
  const router = useRouter();
  const { isAdmin, isManager, isLoading: permissionsLoading } = usePermissions();
  const online = useConnectivity();
  const isDesktop = useDesktopRuntime();
  const isMobileCap = useNativeShell();
  const { features, billingVisibility } = useLicense();
  const billingHidden = isBillingHidden({ features, billingVisibility });
  const remoteBusiness = useAuthedQuery(
    api.settings.getBusiness,
    !FULLY_OFFLINE && online && isAdmin ? {} : "skip",
  );
  const remoteTemplate = useAuthedQuery(
    api.settings.getReceiptTemplate,
    !FULLY_OFFLINE && online && isAdmin ? {} : "skip",
  );
  const [cachedPrint, setCachedPrint] = useState<{
    business: ReceiptBusiness;
    template: ReceiptTemplateConfig;
  } | null>(null);
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const [lastLinkedTab, setLastLinkedTab] = useState<SettingsTab | null>(null);
  const [printRevision, setPrintRevision] = useState(0);
  const requestedSection = useSearchParams().get("section");

  function selectSettingsTab(value: SettingsTab) {
    setTab(value);
    const href = `/settings?section=${encodeURIComponent(value)}`;
    if (replaceClientShellUrl(href)) return;
    router.replace(href, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snapshot = FULLY_OFFLINE
        ? await loadMilliesPrintSnapshot()
        : await loadPrintSnapshotMeta();
      if (cancelled || !snapshot) return;
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
          showAmountPaidAndChange: snapshot.template.showAmountPaidAndChange ?? true,
          showSku: snapshot.template.showSku,
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [printRevision]);

  const business =
    remoteBusiness ??
    cachedPrint?.business ??
    (FULLY_OFFLINE && isAdmin ? DEFAULT_MILLIES_BUSINESS : null);
  const template =
    remoteTemplate ??
    cachedPrint?.template ??
    (FULLY_OFFLINE && isAdmin ? DEFAULT_MILLIES_TEMPLATE : null);

  // Desktop-only terminal hardware never appears in the Capacitor shell.
  const sections = useMemo(
    () =>
      buildSettingsSections({
        isAdmin,
        isManager,
        isDesktop,
        isMobileCap,
        showBilling: !FULLY_OFFLINE && !billingHidden,
        showDevices: !FULLY_OFFLINE,
        fullyOffline: FULLY_OFFLINE,
      }),
    [isAdmin, isManager, isDesktop, isMobileCap, billingHidden],
  );

  const sectionGroups = useMemo(() => groupSettingsSections(sections), [sections]);

  // Banners and in-app links deep-link here with `?section=billing|devices|backup|…`.
  // URL section wins so Privacy → Billing does not stay stuck on the previous tab.
  const linkedTab = sections.find((section) => section.value === requestedSection)?.value ?? null;
  const deniedBillingDeepLink = billingHidden && requestedSection === "billing" && isAdmin;

  if (linkedTab !== lastLinkedTab) {
    setLastLinkedTab(linkedTab);
    if (linkedTab) setTab(linkedTab);
  }

  const activeTab: SettingsTab =
    linkedTab ?? (tab && sections.some((s) => s.value === tab) ? tab : "profile");

  if (permissionsLoading) {
    return <LoadingState label="Loading settings…" variant="form" />;
  }

  if (deniedBillingDeepLink) {
    return (
      <div className="min-w-0 space-y-6 overflow-x-clip">
        <PageHeader title="Settings" />
        <AccessDenied
          title="Billing isn’t available"
          message="Billing for this workspace is managed by Novend. Contact support if you need a plan change."
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      <PageHeader title="Settings" />

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
                <TabsContent value="business" className="mt-0 space-y-5">
                  <GoLivePanel />
                  <BusinessForm
                    key={`${printRevision}:${JSON.stringify(business)}`}
                    initial={business}
                    readOnly={!FULLY_OFFLINE && !online}
                    onLocalSaved={() => setPrintRevision((n) => n + 1)}
                  />
                  <ProductImagesSettingsCard />
                  <ExpiryAlertSettingsCard />
                  <BusinessCapabilitiesPanel />
                  <VatSettingsPanel />
                </TabsContent>

                <TabsContent value="receipt" className="mt-0">
                  <ReceiptTemplateForm
                    key={`${printRevision}:${JSON.stringify(template)}`}
                    initialTemplate={template}
                    initialBusiness={business}
                    readOnly={!FULLY_OFFLINE && !online}
                    onLocalSaved={() => setPrintRevision((n) => n + 1)}
                  />
                </TabsContent>
              </>
            ) : isAdmin && !FULLY_OFFLINE && !online ? (
              <>
                <TabsContent value="business" className="mt-0 space-y-6">
                  <Card>
                    <CardContent className="text-muted-foreground p-5 text-sm">
                      Business and receipt settings haven&apos;t been cached on this device yet.
                      Open Settings once while online to keep them available offline.
                    </CardContent>
                  </Card>
                  <ProductImagesSettingsCard />
                  <ExpiryAlertSettingsCard />
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

            {FULLY_OFFLINE && isAdmin ? (
              <TabsContent value="license" className="mt-0">
                <MilliesLicensePanel />
              </TabsContent>
            ) : null}

            {isAdmin && !FULLY_OFFLINE && !billingHidden ? (
              <TabsContent value="billing" className="mt-0">
                <BillingPanel />
              </TabsContent>
            ) : null}

            {isManager || isAdmin ? (
              <>
                <TabsContent value="branchReceipt" className="mt-0">
                  <BranchReceiptPanel />
                </TabsContent>
                {!FULLY_OFFLINE ? (
                  <TabsContent value="devices" className="mt-0">
                    <DevicesPanel />
                  </TabsContent>
                ) : null}
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
                {!FULLY_OFFLINE ? (
                  <>
                    <TabsContent value="updates" className="mt-0">
                      <UpdatesPanel />
                    </TabsContent>
                    <TabsContent value="desktop" className="mt-0">
                      <DesktopDownloadPanel />
                    </TabsContent>
                  </>
                ) : null}
              </>
            ) : isMobileCap ? (
              <TabsContent value="mobileHardware" className="mt-0">
                <MobileHardwarePanel />
              </TabsContent>
            ) : !FULLY_OFFLINE ? (
              <TabsContent value="desktop" className="mt-0">
                <DesktopDownloadPanel />
              </TabsContent>
            ) : null}

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

            {!FULLY_OFFLINE ? (
              <TabsContent value="privacy" className="mt-0">
                <PrivacyDataPanel />
              </TabsContent>
            ) : null}

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
  license: KeyRound,
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
    <nav
      data-tour="settings-sections"
      className="border-border hidden w-56 shrink-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto"
    >
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
  onLocalSaved,
}: {
  initial: ReceiptBusiness;
  readOnly?: boolean;
  onLocalSaved?: () => void;
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
      if (FULLY_OFFLINE) {
        await saveMilliesBusiness({
          tradeName,
          legalName,
          address,
          phone,
          email: FULLY_OFFLINE ? "" : email,
          taxId,
        });
        onLocalSaved?.();
      } else {
        await withTimeout(
          updateBusiness({ tradeName, legalName, address, phone, email, taxId }),
          12_000,
          "Save timed out — check your connection and try again",
        );
      }
      toast.success("Business profile saved");
    } catch (error) {
      showError(error, "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="rounded-[20px]">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-base">Business profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid max-w-2xl gap-5" onSubmit={onSaveBusiness}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tradeName">Trade name</Label>
              <Input
                id="tradeName"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                required
                disabled={readOnly}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="legalName">Legal name</Label>
              <Input
                id="legalName"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                disabled={readOnly}
                className="min-h-11"
                placeholder="Optional — registered company name"
              />
            </div>
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
                className="min-h-11"
              />
            </div>
            {!FULLY_OFFLINE ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={readOnly}
                  className="min-h-11"
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">Tax ID / TIN</Label>
            <Input
              id="taxId"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              disabled={readOnly}
              className="min-h-11"
              placeholder="Optional"
            />
          </div>
          <Button type="submit" disabled={pending || readOnly} className="w-fit">
            {readOnly
              ? "Can't save offline"
              : pending
                ? "Saving…"
                : FULLY_OFFLINE
                  ? "Save on this till"
                  : "Save business profile"}
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
  onLocalSaved,
}: {
  initialTemplate: ReceiptTemplateConfig;
  initialBusiness: ReceiptBusiness;
  readOnly?: boolean;
  onLocalSaved?: () => void;
}) {
  const online = useConnectivity();
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
  const [showAmountPaidAndChange, setShowAmountPaidAndChange] = useState(
    initialTemplate.showAmountPaidAndChange ?? true,
  );
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
      showAmountPaidAndChange,
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
      showAmountPaidAndChange,
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
      const payload = {
        paperWidthMm: Number(paperWidthMm) as 58 | 80,
        showLogo: false,
        headerText,
        footerText,
        thankYouLine,
        showCashier,
        showCustomer,
        showPaymentMethod,
        showAmountPaidAndChange,
        showSku,
      };
      if (FULLY_OFFLINE) {
        await saveMilliesReceiptTemplate(payload);
        await savePosPreferences({
          receiptPrintMode: printMode,
          autoPrintReceipt: printMode === "automatic",
        });
        onLocalSaved?.();
      } else {
        await withTimeout(updateTemplate(payload), 12_000, "Save timed out — check your connection and try again");
        if (online) {
          try {
            await updatePos({ receiptPrintMode: printMode });
          } catch {
            /* pos prefs optional */
          }
        }
      }
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
                  if (readOnly) return;
                  void (async () => {
                    try {
                      await savePosPreferences({
                        autoPrintReceipt: mode === "automatic",
                        receiptPrintMode: mode,
                      });
                      if (!FULLY_OFFLINE && online) {
                        await updatePos({ receiptPrintMode: mode });
                      }
                    } catch (error) {
                      showError(error, "Could not save print setting");
                    }
                  })();
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
                  id="showAmountPaidAndChange"
                  label="Show amount paid & change"
                  checked={showAmountPaidAndChange}
                  onChange={setShowAmountPaidAndChange}
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
