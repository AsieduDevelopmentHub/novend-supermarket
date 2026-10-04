import { v } from "convex/values";

/** Keep in step with `PaymentMethod` in `lib/payments.ts`. */
export const paymentMethodValidator = v.union(
  v.literal("cash"),
  v.literal("card"),
  v.literal("mobile_money"),
  v.literal("other"),
);
