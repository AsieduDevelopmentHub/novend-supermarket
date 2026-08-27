/**
 * Novend catalog fields that a product import may populate.
 * Keys match the live `products` schema (plus category name and opening qty).
 */

export const PRODUCT_IMPORT_FIELD_KEYS = [
  "name",
  "sku",
  "barcode",
  "category",
  "costPrice",
  "sellingPrice",
  "quantity",
  "unit",
  "lowStockThreshold",
  "description",
  "status",
  "tracksExpiry",
  "expiryAlertDays",
  "expiryDate",
] as const;

export type ProductImportFieldKey = (typeof PRODUCT_IMPORT_FIELD_KEYS)[number];

export type ProductImportField = {
  key: ProductImportFieldKey;
  label: string;
  required: boolean;
  synonyms: string[];
};

export const PRODUCT_IMPORT_FIELDS: ProductImportField[] = [
  {
    key: "name",
    label: "Product Name",
    required: true,
    synonyms: [
      "product name",
      "item name",
      "item",
      "product",
      "product title",
      "title",
      "name",
      "description of goods",
    ],
  },
  {
    key: "sku",
    label: "SKU",
    required: true,
    synonyms: [
      "sku",
      "product code",
      "item code",
      "stock code",
      "code",
      "item no",
      "item number",
      "part number",
      "plu",
    ],
  },
  {
    key: "barcode",
    label: "Barcode",
    required: false,
    synonyms: ["barcode", "barcode no", "barcode number", "ean", "upc", "gtin", "isbn"],
  },
  {
    key: "category",
    label: "Category",
    required: true,
    synonyms: ["category", "group", "department", "dept", "product group", "class"],
  },
  {
    key: "costPrice",
    label: "Cost Price",
    required: true,
    synonyms: ["cost price", "cost", "unit cost", "buying price", "purchase price", "cogs"],
  },
  {
    key: "sellingPrice",
    label: "Selling Price",
    required: true,
    synonyms: [
      "selling price",
      "sale price",
      "retail price",
      "price",
      "unit price",
      "sell price",
      "sp",
    ],
  },
  {
    key: "quantity",
    label: "Quantity",
    required: false,
    synonyms: [
      "quantity",
      "qty",
      "stock",
      "stock quantity",
      "on hand",
      "onhand",
      "opening stock",
      "balance",
    ],
  },
  {
    key: "unit",
    label: "Unit",
    required: false,
    synonyms: ["unit", "uom", "measure", "pack"],
  },
  {
    key: "lowStockThreshold",
    label: "Minimum Stock",
    required: false,
    synonyms: ["minimum stock", "low stock", "reorder", "reorder level", "min qty", "threshold"],
  },
  {
    key: "description",
    label: "Description",
    required: false,
    synonyms: ["description", "notes", "details", "product description"],
  },
  {
    key: "status",
    label: "Status",
    required: false,
    synonyms: ["status", "active", "state"],
  },
  {
    key: "tracksExpiry",
    label: "Tracks Expiry",
    required: false,
    synonyms: ["tracks expiry", "track expiry", "expires", "dated", "has expiry"],
  },
  {
    key: "expiryAlertDays",
    label: "Expiry Alert Days",
    required: false,
    synonyms: ["expiry alert days", "alert days", "expiry days"],
  },
  {
    key: "expiryDate",
    label: "Expiry Date",
    required: false,
    synonyms: [
      "expiry date",
      "expiration date",
      "best before",
      "best before date",
      "bbd",
      "expiry",
      "expires on",
    ],
  },
];

export const PRODUCT_IMPORT_TEMPLATE_HEADERS = PRODUCT_IMPORT_FIELDS.map((field) => field.label);
