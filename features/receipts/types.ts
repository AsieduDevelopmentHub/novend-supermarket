export type ReceiptBusiness = {
  /** Organization title (e.g. Princellen…) — never replaced by branch. */
  tradeName: string;
  legalName: string;
  /** Branch line under the org header when present. */
  branchName?: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
};

export type ReceiptTemplateConfig = {
  paperWidthMm: 58 | 80;
  showLogo: boolean;
  headerText: string;
  footerText: string;
  thankYouLine: string;
  showCashier: boolean;
  showCustomer: boolean;
  showPaymentMethod: boolean;
  showSku: boolean;
};

export type ReceiptLine = {
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
};

export type ReceiptPayload = {
  kind?: "sale" | "return";
  invoiceNumber: string;
  saleId?: string;
  returnId?: string;
  returnNumber?: string;
  originalInvoiceNumber?: string;
  returnReason?: string;
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
  lines: ReceiptLine[];
  paymentMethod: string;
  completedAt: number;
  customerName: string;
  customerPhone?: string | null;
  customerId?: string | null;
  cashierName?: string;
  business: ReceiptBusiness;
  template: ReceiptTemplateConfig;
};

export const SAMPLE_RECEIPT_PAYLOAD: ReceiptPayload = {
  invoiceNumber: "INV-1001",
  subtotal: 245,
  discount: 5,
  total: 240,
  itemCount: 6,
  lines: [
    {
      productName: "Peeva Still Water 1.5L",
      sku: "PRD-WATER",
      quantity: 4,
      unitPrice: 35,
      discount: 0,
      lineTotal: 140,
    },
    {
      productName: "House Red Wine",
      sku: "PRD-WINE",
      quantity: 2,
      unitPrice: 55,
      discount: 5,
      lineTotal: 105,
    },
  ],
  paymentMethod: "cash",
  completedAt: Date.now(),
  customerName: "Walk-in Customer",
  customerPhone: null,
  cashierName: "Cashier",
  business: {
    tradeName: "Novend",
    legalName: "Novend",
    address: "",
    phone: "",
    email: "",
    taxId: "",
  },
  template: {
    paperWidthMm: 80,
    showLogo: true,
    headerText: "Smart POS. Strong business.",
    footerText: "Thank you for your business",
    thankYouLine: "Goods sold are not returnable without receipt",
    showCashier: true,
    showCustomer: true,
    showPaymentMethod: true,
    showSku: false,
  },
};
