/** Product UI screenshots — served from /marketing/ui/ for landing & docs. */
export const MARKETING_UI_SCREENS = {
  authLogin: "/marketing/ui/auth-login.png",
  authLoginAlt: "/marketing/ui/auth-login-alt.png",
  authSignup: "/marketing/ui/auth-signup.png",
  businessOnboarding: "/marketing/ui/business-onboarding.png",
  dashboard: "/marketing/ui/dashboard.png",
  salesPos: "/marketing/ui/sales-pos.png",
  salesPosReceiptModal: "/marketing/ui/sales-pos-receipt-modal.png",
  salesOrders: "/marketing/ui/sales-orders.png",
  salesOrderDetail: "/marketing/ui/sales-order-detail.png",
  salesReturns: "/marketing/ui/sales-returns.png",
  salesReturnDetail: "/marketing/ui/sales-return-detail.png",
  salesCustomerDetail: "/marketing/ui/sales-customer-detail.png",
  inventoryProducts: "/marketing/ui/inventory-products.png",
  inventoryStock: "/marketing/ui/inventory-stock.png",
  inventoryWholesale: "/marketing/ui/inventory-wholesale.png",
  inventorySuppliers: "/marketing/ui/inventory-suppliers.png",
  inventoryProductDetail: "/marketing/ui/inventory-product-detail.png",
  inventoryProductDetailExpiry: "/marketing/ui/inventory-product-detail-expiry.png",
  inventoryProductEditModal: "/marketing/ui/inventory-product-edit-modal.png",
  inventoryAdjustStockModal: "/marketing/ui/inventory-adjust-stock-modal.png",
  inventoryTransferStockModal: "/marketing/ui/inventory-transfer-stock-modal.png",
  inventoryWholesaleIssueModal: "/marketing/ui/inventory-wholesale-issue-modal.png",
  inventoryWholesaleRecordPurchaseModal:
    "/marketing/ui/inventory-wholesale-record-purchase-modal.png",
  businessAnalyticsOverview: "/marketing/ui/business-analytics-overview.png",
  businessAnalyticsExpenses: "/marketing/ui/business-analytics-expenses.png",
  businessAnalyticsPnl: "/marketing/ui/business-analytics-pnl.png",
  businessAnalyticsRevenue: "/marketing/ui/business-analytics-revenue.png",
  businessAnalyticsRecordExpenseModal: "/marketing/ui/business-analytics-record-expense-modal.png",
  businessReports: "/marketing/ui/business-reports.png",
  businessReportsDailyBreakdown: "/marketing/ui/business-reports-daily-breakdown.png",
  businessReportsDayDetail: "/marketing/ui/business-reports-day-detail.png",
  administrationBranches: "/marketing/ui/administration-branches.png",
  administrationBranchDetail: "/marketing/ui/administration-branch-detail.png",
  administrationUsers: "/marketing/ui/administration-users.png",
  administrationUserDetail: "/marketing/ui/administration-user-detail.png",
  settingsProfile: "/marketing/ui/settings-profile.png",
  settingsReceiptTemplate: "/marketing/ui/settings-receipt-template.png",
  settingsBusinessProfile: "/marketing/ui/settings-business-profile.png",
  settingsBillingPlan: "/marketing/ui/settings-billing-plan.png",
  settingsBillingCloudBackup: "/marketing/ui/settings-billing-cloud-backup.png",
  settingsBranchReceipt: "/marketing/ui/settings-branch-receipt.png",
  settingsActivatedDevices: "/marketing/ui/settings-activated-devices.png",
  settingsHardwarePrinter: "/marketing/ui/settings-hardware-printer.png",
  settingsHardwareBarcodeScanner: "/marketing/ui/settings-hardware-barcode-scanner.png",
  settingsDesktopUpdates: "/marketing/ui/settings-desktop-updates.png",
  settingsLocalBackup: "/marketing/ui/settings-local-backup.png",
  syncRecent: "/marketing/ui/sync-recent.png",
} as const;

/** Journey scrollytelling — one real screen per workflow step. */
export const JOURNEY_STEP_SCREENS = {
  receive: MARKETING_UI_SCREENS.inventoryWholesaleRecordPurchaseModal,
  warehouse: MARKETING_UI_SCREENS.inventoryWholesale,
  transfer: MARKETING_UI_SCREENS.inventoryWholesaleIssueModal,
  sell: MARKETING_UI_SCREENS.salesPos,
  local: MARKETING_UI_SCREENS.inventoryStock,
  sync: MARKETING_UI_SCREENS.syncRecent,
} as const;

/** Feature showcase — one real screen (or split pair) per capability block. */
export const FEATURE_BLOCK_SCREENS = {
  checkout: "/marketing/ui/sales-pos.jpg",
  inventory: MARKETING_UI_SCREENS.inventoryStock,
  wholesale: MARKETING_UI_SCREENS.inventoryWholesale,
  analytics: MARKETING_UI_SCREENS.businessAnalyticsOverview,
  relationships: {
    primary: MARKETING_UI_SCREENS.salesCustomerDetail,
    secondary: MARKETING_UI_SCREENS.inventorySuppliers,
  },
  reports: MARKETING_UI_SCREENS.businessReports,
} as const;

/** Industry selector — vertical-specific POS sale screenshots. */
export const INDUSTRY_SHOWCASE_SCREENS = {
  pharmacy: "/marketing/ui/sale-pharmacy.jpg",
  supermarket: "/marketing/ui/sale-supermarket.jpg",
  wholesale: "/marketing/ui/sale-wholesale.jpg",
  fashion: "/marketing/ui/sale-fashion.jpg",
  electronics: "/marketing/ui/sale-electronics.jpg",
  convenience: "/marketing/ui/sale-convenience.jpg",
} as const;

export type DocsDemoShot = {
  src: string;
  alt: string;
  caption: string;
};

/** Documentation guide — real product screens paired with each docs section. */
export const DOCS_SECTION_DEMOS: Record<string, readonly DocsDemoShot[]> = {
  "getting-started": [
    {
      src: MARKETING_UI_SCREENS.authSignup,
      alt: "Novend create account signup screen",
      caption: "Create your account and accept Terms & Privacy",
    },
    {
      src: MARKETING_UI_SCREENS.businessOnboarding,
      alt: "Novend business onboarding — create your organization",
      caption: "Set up your business name and details",
    },
    {
      src: MARKETING_UI_SCREENS.dashboard,
      alt: "Novend dashboard with sales KPIs",
      caption: "Land on your dashboard after onboarding",
    },
    {
      src: MARKETING_UI_SCREENS.authLogin,
      alt: "Novend sign-in screen",
      caption: "Sign back in anytime to your workspace",
    },
  ],
  sales: [
    {
      src: "/marketing/ui/sales-pos.jpg",
      alt: "Novend POS checkout with product grid and cart",
      caption: "Sell with barcode search and a live cart",
    },
    {
      src: MARKETING_UI_SCREENS.salesPosReceiptModal,
      alt: "Novend receipt modal after checkout",
      caption: "Immutable receipt after payment",
    },
    {
      src: MARKETING_UI_SCREENS.salesOrders,
      alt: "Novend orders list",
      caption: "Review and reprint from Orders",
    },
  ],
  inventory: [
    {
      src: MARKETING_UI_SCREENS.inventoryProducts,
      alt: "Novend product catalog",
      caption: "Products, SKUs, and pricing",
    },
    {
      src: MARKETING_UI_SCREENS.inventoryStock,
      alt: "Novend branch stock table",
      caption: "Branch stock with low-stock visibility",
    },
    {
      src: MARKETING_UI_SCREENS.inventoryWholesale,
      alt: "Novend wholesale warehouse inventory",
      caption: "Wholesale storage separate from the floor",
    },
  ],
  transfers: [
    {
      src: MARKETING_UI_SCREENS.inventoryTransferStockModal,
      alt: "Novend transfer stock modal",
      caption: "Transfer stock between branches",
    },
    {
      src: MARKETING_UI_SCREENS.inventoryWholesaleIssueModal,
      alt: "Novend wholesale issue to branch modal",
      caption: "Issue warehouse stock to a branch",
    },
    {
      src: MARKETING_UI_SCREENS.inventoryAdjustStockModal,
      alt: "Novend adjust stock modal",
      caption: "Adjust quantities with a clear reason",
    },
  ],
  offline: [
    {
      src: MARKETING_UI_SCREENS.syncRecent,
      alt: "Novend recent sync activity",
      caption: "See what synced after you reconnect",
    },
    {
      src: MARKETING_UI_SCREENS.settingsLocalBackup,
      alt: "Novend local backup settings",
      caption: "Local backup options on device",
    },
  ],
  hardware: [
    {
      src: MARKETING_UI_SCREENS.settingsHardwareBarcodeScanner,
      alt: "Novend barcode scanner settings",
      caption: "Configure barcode scanning",
    },
    {
      src: MARKETING_UI_SCREENS.settingsHardwarePrinter,
      alt: "Novend receipt printer settings",
      caption: "Connect a thermal receipt printer",
    },
    {
      src: MARKETING_UI_SCREENS.settingsActivatedDevices,
      alt: "Novend activated devices list",
      caption: "Manage activated selling devices",
    },
  ],
  customers: [
    {
      src: MARKETING_UI_SCREENS.salesCustomerDetail,
      alt: "Novend customer profile",
      caption: "Customer history and balances",
    },
    {
      src: MARKETING_UI_SCREENS.inventorySuppliers,
      alt: "Novend suppliers directory",
      caption: "Supplier records in one place",
    },
    {
      src: MARKETING_UI_SCREENS.salesReturns,
      alt: "Novend returns list",
      caption: "Returns against completed sales",
    },
  ],
  analytics: [
    {
      src: MARKETING_UI_SCREENS.businessAnalyticsOverview,
      alt: "Novend analytics overview dashboard",
      caption: "Revenue and performance at a glance",
    },
    {
      src: MARKETING_UI_SCREENS.businessReports,
      alt: "Novend business reports",
      caption: "Exportable business reports",
    },
    {
      src: MARKETING_UI_SCREENS.businessAnalyticsPnl,
      alt: "Novend profit and loss analytics",
      caption: "Profit and loss insights",
    },
  ],
  admin: [
    {
      src: MARKETING_UI_SCREENS.administrationUsers,
      alt: "Novend users administration",
      caption: "Invite and role-manage your team",
    },
    {
      src: MARKETING_UI_SCREENS.administrationBranches,
      alt: "Novend branches list",
      caption: "Open and manage branches",
    },
    {
      src: MARKETING_UI_SCREENS.settingsBillingPlan,
      alt: "Novend billing plan settings",
      caption: "Plans, capacity, and upgrades",
    },
  ],
  security: [
    {
      src: MARKETING_UI_SCREENS.settingsProfile,
      alt: "Novend user profile settings",
      caption: "Keep your profile and access current",
    },
    {
      src: MARKETING_UI_SCREENS.settingsBusinessProfile,
      alt: "Novend business profile settings",
      caption: "Organization profile and defaults",
    },
  ],
};
