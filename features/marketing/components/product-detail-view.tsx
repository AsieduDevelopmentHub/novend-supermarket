import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpandableScreenshot } from "@/features/marketing/components/expandable-screenshot";
import { LandingCta } from "@/features/marketing/components/landing-cta";
import type { ProductPageContent } from "@/features/marketing/product-pages";

/** Shared public product detail layout — outcome, workflow, capabilities, offline note. */
export function ProductDetailView({ page }: { page: ProductPageContent }) {
  return (
    <div className="bg-[#F8FAFC]">
      <section className="border-b border-[rgba(11,18,32,0.08)] bg-gradient-to-b from-[#EFF8FF] to-[#F8FAFC]">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8 lg:py-20">
          <div>
            <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
              {page.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0B1220] sm:text-4xl lg:text-5xl lg:leading-[1.05]">
              {page.title}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-pretty text-[#526174] sm:text-lg">
              {page.summary}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="h-12 rounded-full px-7 font-semibold">
                <Link href="/signup">Start free for 14 days</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-slate-300 bg-white px-7 font-semibold"
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>

          <ExpandableScreenshot
            src={page.heroImage}
            alt={page.heroAlt}
            className="overflow-hidden rounded-[20px] border border-[rgba(11,18,32,0.10)] bg-white shadow-[0_28px_70px_-40px_rgba(11,18,32,0.45)]"
          >
            <Image
              src={page.heroImage}
              alt={page.heroAlt}
              width={1440}
              height={900}
              className="h-auto w-full object-cover object-top"
              sizes="(max-width: 1024px) 92vw, 560px"
              priority
            />
          </ExpandableScreenshot>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
          Outcome
        </p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-[#0B1220] sm:text-3xl">
          {page.outcome}
        </h2>

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {page.workflow.map((step, index) => (
            <li
              key={step.title}
              className="rounded-[20px] border border-[rgba(11,18,32,0.10)] bg-white p-5 sm:p-6"
            >
              <span className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 text-base font-semibold text-[#0B1220]">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#526174]">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
              Capabilities
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#0B1220] sm:text-3xl">
              What you get in this module
            </h2>
            <ul className="mt-6 space-y-3">
              {page.capabilities.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] text-[#0B1220]">
                  <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[20px] border border-[rgba(11,18,32,0.10)] bg-[#EFF8FF] p-6 sm:p-8">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#0284C7] uppercase">
              Offline behavior
            </p>
            <p className="mt-3 text-base leading-relaxed text-[#0B1220]">{page.offlineNote}</p>
            <p className="mt-6 text-sm leading-relaxed text-[#526174]">
              <span className="font-semibold text-[#0B1220]">Platforms: </span>
              {page.platforms}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-[#0B1220]">Related</p>
        <ul className="mt-4 flex flex-wrap gap-3">
          {page.related.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="border-primary/25 text-primary inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-sm font-semibold"
              >
                {item.label}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <LandingCta />
    </div>
  );
}
