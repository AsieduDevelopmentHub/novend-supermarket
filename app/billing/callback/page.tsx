import type { Metadata } from "next";
import { CheckoutReturnView } from "@/features/billing/components/checkout-return-view";

export const metadata: Metadata = {
  title: "Confirming payment",
  robots: { index: false, follow: false },
};

/** Public Paystack return URL — must not sit behind the authenticated app shell. */
export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="bg-background min-h-dvh overflow-y-auto">
      <CheckoutReturnView reference={params.reference ?? params.trxref ?? null} />
    </div>
  );
}
