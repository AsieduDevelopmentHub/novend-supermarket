import type { LucideIcon } from "lucide-react";

export type SettingsTab =
  | "profile"
  | "receipt"
  | "business"
  | "billing"
  | "devices"
  | "branchReceipt"
  | "printer"
  | "customerDisplay"
  | "scanner"
  | "mobileHardware"
  | "futureDevices"
  | "updates"
  | "desktop"
  | "backup"
  | "appearance"
  | "security"
  | "privacy"
  | "help"
  | "license";

export type SettingsSection = {
  value: SettingsTab;
  label: string;
  long: string;
};

export type SettingsSectionGroup = {
  label: string;
  items: SettingsSection[];
};

const HARDWARE_TABS: SettingsTab[] = [
  "printer",
  "customerDisplay",
  "scanner",
  "mobileHardware",
  "futureDevices",
];

/** Build settings sections for the current runtime (desktop shell, mobile app, or browser). */
export function buildSettingsSections(input: {
  isAdmin: boolean;
  isManager: boolean;
  isDesktop: boolean;
  isMobileCap: boolean;
  /** When false, Billing is omitted (platform billingVisibility / billing.view). */
  showBilling?: boolean;
  /** When false, cloud device-activation list is omitted (Millie's local till). */
  showDevices?: boolean;
  /** Millie's fully offline till — hide cloud/privacy/download surfaces. */
  fullyOffline?: boolean;
}): SettingsSection[] {
  const {
    isAdmin,
    isManager,
    isDesktop,
    isMobileCap,
    showBilling = true,
    showDevices = true,
    fullyOffline = false,
  } = input;

  const terminalSections: SettingsSection[] = isDesktop
    ? [
        { value: "printer", label: "Printer", long: "Printer" },
        { value: "customerDisplay", label: "Display", long: "Customer display" },
        { value: "scanner", label: "Scanner", long: "Barcode scanner" },
        { value: "futureDevices", label: "Future", long: "Future devices" },
        ...(fullyOffline
          ? []
          : ([
              { value: "updates", label: "Updates", long: "Desktop updates" },
              { value: "desktop", label: "Downloads", long: "Download apps" },
            ] as SettingsSection[])),
      ]
    : isMobileCap
      ? [{ value: "mobileHardware", label: "Hardware", long: "Printer, camera & sharing" }]
      : [
          { value: "scanner", label: "Scanner", long: "Barcode scanner" },
          { value: "customerDisplay", label: "Display", long: "Customer display" },
          ...(fullyOffline
            ? []
            : ([{ value: "desktop", label: "Downloads", long: "Download apps" }] as SettingsSection[])),
        ];

  const adminSections: SettingsSection[] = isAdmin
    ? [
        { value: "receipt", label: "Receipt", long: "Receipt template" },
        { value: "business", label: "Business", long: "Business profile" },
        ...(fullyOffline
          ? ([{ value: "license", label: "License", long: "License" }] as SettingsSection[])
          : []),
        ...(showBilling && !fullyOffline
          ? ([{ value: "billing", label: "Billing", long: "Billing & plan" }] as SettingsSection[])
          : []),
      ]
    : [];

  const branchSections: SettingsSection[] =
    isManager || isAdmin
      ? [
          {
            value: "branchReceipt",
            label: fullyOffline ? "Store" : "Branch",
            long: fullyOffline ? "Store receipt" : "Branch receipt",
          },
          ...(showDevices && !fullyOffline
            ? ([{ value: "devices", label: "Devices", long: "Activated devices" }] as SettingsSection[])
            : []),
        ]
      : [];

  return [
    { value: "profile", label: "Profile", long: "Profile" },
    ...adminSections,
    ...branchSections,
    ...terminalSections,
    {
      value: "backup",
      label: "Backups",
      long: fullyOffline ? "Local backups" : "Backups",
    },
    { value: "appearance", label: "Appearance", long: "Appearance" },
    { value: "security", label: "Security", long: "Security" },
    ...(fullyOffline
      ? []
      : ([{ value: "privacy", label: "Privacy", long: "Privacy & data" }] as SettingsSection[])),
    { value: "help", label: "Help", long: "Help & tours" },
  ];
}

export function groupSettingsSections(sections: SettingsSection[]): SettingsSectionGroup[] {
  const hardwareItems = sections.filter((item) => HARDWARE_TABS.includes(item.value));

  return [
    {
      label: "Account",
      items: sections.filter((item) =>
        ["profile", "appearance", "security", "privacy", "help"].includes(item.value),
      ),
    },
    {
      label: "Business",
      items: sections.filter((item) =>
        ["business", "receipt", "billing", "license"].includes(item.value),
      ),
    },
    {
      label: "Store",
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
      items: sections.filter((item) => ["updates", "desktop", "backup"].includes(item.value)),
    },
  ].filter((group) => group.items.length > 0);
}

export type SettingsSectionIconMap = Record<SettingsTab, LucideIcon>;

export { HARDWARE_TABS };
