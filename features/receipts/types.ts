export type ReceiptBusiness = {
  /** Organization title (e.g. East Legon Pharmacy) — never replaced by branch. */
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
  sellUnitLabel?: string;
  pricingMode?: "fixed" | "per_weight";
};

export type ReceiptPaymentLine = {
  method: string;
  amount: number;
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
  /** Primary tender (largest amount when the sale was split). */
  paymentMethod: string;
  /** Present only for split or on-account sales; lines sum to `total`. */
  payments?: ReceiptPaymentLine[];
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
    tradeName: "Millie's Supermarket",
    legalName: "Millie's Supermarket",
    address: "",
    phone: "",
    email: "",
    taxId: "",
  },
  template: {
    paperWidthMm: 80,
    showLogo: true,
    headerText: "Millie's Supermarket",
    footerText: "Thank you for shopping with us",
    thankYouLine: "Come again soon",
    showCashier: true,
    showCustomer: false,
    showPaymentMethod: true,
    showSku: false,
  },
};
