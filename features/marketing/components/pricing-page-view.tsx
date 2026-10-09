import Link from "next/link";
import { TrackPricingView } from "@/lib/analytics/track-pricing-view";
import { LandingPricing } from "@/features/marketing/components/landing-pricing";
import { LandingCta } from "@/features/marketing/components/landing-cta";
import { LandingFaq } from "@/features/marketing/components/landing-faq";
import { Button } from "@/components/ui/button";
import { appEntryHref } from "@/lib/hosting/hosts";

/**
 * Public marketing pricing page — visible without an account.
 * Distinct from authenticated Settings → Billing.
 */
export function PricingPageView() {
  return (
    <div className="bg-[#F8FAFC]">
      <TrackPricingView />
      <section className="border-b border-[rgba(11,18,32,0.08)] bg-gradient-to-b from-[#EFF8FF] to-[#F8FAFC]">
        <div
          data-reveal
          className="mx-auto max-w-[820px] px-4 py-14 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-20"
        >
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            Pricing
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0B1220] sm:text-4xl lg:text-5xl lg:leading-[1.05]">
            Plans for a single counter or many branches
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-pretty text-[#526174] sm:text-lg">
            From Starter (100 products) through Enterprise. Every plan includes offline POS after
            setup, barcode support, receipts, inventory, and cloud sync. No account required to
            review limits here — sign up only when you are ready to start the trial.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full px-7 font-semibold">
              <Link href={appEntryHref("/signup")}>Start free for 14 days</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-slate-300 bg-white px-7 font-semibold"
            >
              <Link href="/product/pos">Explore the product</Link>
            </Button>
          </div>
        </div>
      </section>

      <LandingPricing />

      <section data-reveal className="mx-auto max-w-[820px] px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold tracking-tight text-[#0B1220]">Billing notes</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#526174]">
          <li>
            Trial converts to the plan you choose at signup. Cancel anytime during the trial without
            a card requirement to explore.
          </li>
          <li>
            Plan limits for products, users, branches, devices, and backup are enforced in the
            product. When you reach a limit, upgrade or free capacity to continue that action.
          </li>
          <li>
            Existing Lifetime licences remain valid for organizations that already purchased
            them. Lifetime is no longer offered for new sales—contact Novend if you need to
            migrate or discuss commercial terms.
          </li>
          <li>
            Authenticated owners manage payment methods and invoices in Settings → Billing after
            signup. This public page is for evaluation only.
          </li>
        </ul>
      </section>

      <LandingFaq />
      <LandingCta />
    </div>
  );
}
