/**
 * Optional supermarket sample catalogue + demo sales at first-boot setup.
 */

import {
  MILLIES_LOCAL_BRANCH_ID,
  MILLIES_LOCAL_BRANCH_NAME,
} from "@/constants/runtime";
import { getOfflineDb, newClientId } from "./db";
import type { MilliesSessionUser } from "./millies-auth";
import type {
  MirroredBranchStock,
  MirroredCategory,
  MirroredOrder,
  MirroredOrderItem,
  MirroredProduct,
} from "./types";

const SAMPLE_CATEGORIES: Array<{ id: string; name: string; slug: string }> = [
  { id: "millies-sample-cat-fresh", name: "Sample · Fresh", slug: "sample-fresh" },
  { id: "millies-sample-cat-dairy", name: "Sample · Dairy", slug: "sample-dairy" },
  { id: "millies-sample-cat-pantry", name: "Sample · Pantry", slug: "sample-pantry" },
  { id: "millies-sample-cat-snacks", name: "Sample · Snacks", slug: "sample-snacks" },
];

const SAMPLE_PRODUCTS: Array<{
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  categoryName: string;
  cost: number;
  sell: number;
  stock: number;
  unit: string;
  low: number;
}> = [
  {
    id: "millies-sample-prd-tom",
    name: "Tomatoes 1kg",
    sku: "SMP-TOM-1",
    barcode: "6003001001001",
    categoryId: SAMPLE_CATEGORIES[0]!.id,
    categoryName: SAMPLE_CATEGORIES[0]!.name,
    cost: 6,
    sell: 10,
    stock: 35,
    unit: "kg",
    low: 8,
  },
  {
    id: "millies-sample-prd-mlk",
    name: "Fresh Milk 1L",
    sku: "SMP-MLK-1",
    barcode: "6003001001002",
    categoryId: SAMPLE_CATEGORIES[1]!.id,
    categoryName: SAMPLE_CATEGORIES[1]!.name,
    cost: 8,
    sell: 12,
    stock: 40,
    unit: "bottles",
    low: 10,
  },
  {
    id: "millies-sample-prd-egg",
    name: "Eggs Tray",
    sku: "SMP-EGG-TR",
    barcode: "6003001001003",
    categoryId: SAMPLE_CATEGORIES[1]!.id,
    categoryName: SAMPLE_CATEGORIES[1]!.name,
    cost: 18,
    sell: 25,
    stock: 28,
    unit: "trays",
    low: 6,
  },
  {
    id: "millies-sample-prd-sug",
    name: "Sugar 1kg",
    sku: "SMP-SUG-1",
    barcode: "6003001001004",
    categoryId: SAMPLE_CATEGORIES[2]!.id,
    categoryName: SAMPLE_CATEGORIES[2]!.name,
    cost: 10,
    sell: 14,
    stock: 50,
    unit: "bags",
    low: 12,
  },
  {
    id: "millies-sample-prd-bis",
    name: "Biscuits Pack",
    sku: "SMP-BIS-1",
    barcode: "6003001001005",
    categoryId: SAMPLE_CATEGORIES[3]!.id,
    categoryName: SAMPLE_CATEGORIES[3]!.name,
    cost: 4,
    sell: 7,
    stock: 60,
    unit: "packs",
    low: 15,
  },
  {
    id: "millies-sample-prd-oil",
    name: "Cooking Oil 1L",
    sku: "SMP-OIL-1",
    barcode: "6003001001006",
    categoryId: SAMPLE_CATEGORIES[2]!.id,
    categoryName: SAMPLE_CATEGORIES[2]!.name,
    cost: 22,
    sell: 30,
    stock: 45,
    unit: "bottles",
    low: 10,
  },
];

export async function seedMilliesSampleCatalog(session: MilliesSessionUser): Promise<void> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local business database unavailable");

  const now = Date.now();
  const branchId = session.branchId || MILLIES_LOCAL_BRANCH_ID;
  const branchName = session.branchName || MILLIES_LOCAL_BRANCH_NAME;

  const categories: MirroredCategory[] = SAMPLE_CATEGORIES.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    isActive: true,
    isSample: true,
  }));
  await db.categories.bulkPut(categories);

  for (const p of SAMPLE_PRODUCTS) {
    const product: MirroredProduct = {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      sellingPrice: p.sell,
      costPrice: p.cost,
      stockQuantity: p.stock,
      sellableQuantity: p.stock,
      unit: p.unit,
      lowStockThreshold: p.low,
      status: "active",
      description: "Sample product for exploring Millie's",
      imageUrl: null,
      isSample: true,
      updatedAt: now,
    };
    await db.products.put(product);

    const stock: MirroredBranchStock = {
      id: `${branchId}:${p.id}`,
      branchId,
      productId: p.id,
      quantity: p.stock,
      sellableQuantity: p.stock,
      updatedAt: now,
    };
    await db.branchStock.put(stock);
  }

  const demos: Array<{
    invoice: string;
    offsetMs: number;
    lines: Array<{ productIndex: number; qty: number }>;
    method: "cash" | "mobile_money";
  }> = [
    {
      invoice: "SMP-1001",
      offsetMs: 0,
      lines: [
        { productIndex: 0, qty: 2 },
        { productIndex: 4, qty: 1 },
      ],
      method: "cash",
    },
    {
      invoice: "SMP-1002",
      offsetMs: -3_600_000,
      lines: [{ productIndex: 1, qty: 1 }],
      method: "mobile_money",
    },
    {
      invoice: "SMP-1003",
      offsetMs: -86_400_000,
      lines: [
        { productIndex: 3, qty: 1 },
        { productIndex: 5, qty: 1 },
      ],
      method: "cash",
    },
  ];

  for (const demo of demos) {
    const orderId = newClientId("sample-sale");
    const completedAt = now + demo.offsetMs;
    const lines = demo.lines.map((line) => {
      const product = SAMPLE_PRODUCTS[line.productIndex]!;
      return {
        productId: product.id,
        productName: product.name,
        quantity: line.qty,
        unitPrice: product.sell,
        discount: 0,
        lineTotal: product.sell * line.qty,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const order: MirroredOrder = {
      id: orderId,
      invoiceNumber: demo.invoice,
      customerId: null,
      customerName: "Walk-in",
      cashierId: session.id,
      cashierName: session.displayName,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      discount: 0,
      total: subtotal,
      paymentMethod: demo.method,
      payments: [{ method: demo.method, amount: subtotal }],
      status: "completed",
      completedAt,
      branchId,
      branchName,
      isSample: true,
    };
    await db.orders.put(order);

    for (const line of lines) {
      const item: MirroredOrderItem = {
        id: newClientId("sample-item"),
        orderId,
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: 0,
        lineTotal: line.lineTotal,
        returnedQuantity: 0,
      };
      await db.orderItems.put(item);

      const stockRow = await db.branchStock.get(`${branchId}:${line.productId}`);
      if (stockRow) {
        const next = Math.max(0, stockRow.quantity - line.quantity);
        await db.branchStock.put({
          ...stockRow,
          quantity: next,
          sellableQuantity: next,
          updatedAt: completedAt,
        });
      }
      const product = await db.products.get(line.productId);
      if (product) {
        const nextStock = Math.max(0, product.stockQuantity - line.quantity);
        await db.products.put({
          ...product,
          stockQuantity: nextStock,
          sellableQuantity: nextStock,
          updatedAt: completedAt,
        });
      }
    }
  }
}
