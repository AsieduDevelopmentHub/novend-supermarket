export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Proportional refund for a returned quantity, including cart-discount share. */
export function lineRefundAmount(args: {
  returningQty: number;
  soldQty: number;
  lineTotal: number;
  saleSubtotal: number;
  saleCartDiscount: number;
}): number {
  if (args.returningQty <= 0 || args.soldQty <= 0) return 0;
  const gross = (args.returningQty / args.soldQty) * args.lineTotal;
  const cartShare =
    args.saleSubtotal > 0 ? (gross / args.saleSubtotal) * args.saleCartDiscount : 0;
  return roundMoney(Math.max(0, gross - cartShare));
}

export function estimateReturnRefund(args: {
  saleTotal: number;
  saleSubtotal: number;
  saleCartDiscount: number;
  alreadyRefunded: number;
  remainingQty: number;
  lines: Array<{
    returningQty: number;
    soldQty: number;
    lineTotal: number;
    remainingQty: number;
  }>;
}): number {
  const returningQty = args.lines.reduce((sum, line) => sum + line.returningQty, 0);
  let computed = 0;
  for (const line of args.lines) {
    computed += lineRefundAmount({
      returningQty: line.returningQty,
      soldQty: line.soldQty,
      lineTotal: line.lineTotal,
      saleSubtotal: args.saleSubtotal,
      saleCartDiscount: args.saleCartDiscount,
    });
  }
  const remainingRefundable = roundMoney(Math.max(0, args.saleTotal - args.alreadyRefunded));
  if (returningQty >= args.remainingQty) return remainingRefundable;
  return roundMoney(Math.min(computed, remainingRefundable));
}
