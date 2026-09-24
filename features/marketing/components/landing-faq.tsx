import Image from "next/image";
import { Plus } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { BRANDING } from "@/constants/branding";
import { landingCopy } from "@/features/marketing/content";
import { LandingSection } from "@/features/marketing/components/landing-section";

/** Homepage FAQ — concise accordion with support contact. */
export function LandingFaq() {
  const { faq } = landingCopy;

  return (
    <LandingSection id="faq" tone="pearl" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {faq.badge}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0F172A] sm:text-4xl">
            {faq.title}
          </h2>
        </header>

        <div
          data-reveal
          className="mt-12 grid gap-6 lg:mt-14 lg:grid-cols-[1.35fr_0.9fr] lg:items-start lg:gap-8"
        >
          <Accordion type="single" collapsible className="flex flex-col gap-3">
            {faq.items.map((item, index) => (
              <AccordionItem
                key={item.q}
                value={`faq-${index}`}
                className="overflow-hidden rounded-[16px] border border-slate-200/80 bg-white px-4 sm:px-5"
              >
                <AccordionTrigger className="group gap-3 py-4 text-left text-[15px] font-medium text-[#0F172A] hover:no-underline sm:py-5 [&>svg:last-child]:hidden">
                  <span className="pr-2">{item.q}</span>
                  <Plus
                    className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-45"
                    aria-hidden
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-slate-600">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <aside className="relative overflow-hidden rounded-[20px] border border-slate-200/80 bg-[#F8FAFC] p-6 sm:p-7 lg:sticky lg:top-28">
            <div className="flex items-end gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-semibold tracking-tight text-[#0F172A]">
                  {faq.contactTitle}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{faq.contactDetail}</p>
                <Button asChild className="mt-6 font-semibold">
                  <a href={faq.contactHref}>{faq.contactCta}</a>
                </Button>
              </div>

              <div className="h-24 w-24 shrink-0 self-end sm:h-28 sm:w-28">
                <Image
                  src={BRANDING.landingFaqHeadset}
                  alt=""
                  width={160}
                  height={160}
                  className="h-full w-full object-contain object-bottom"
                  sizes="112px"
                  aria-hidden
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </LandingSection>
  );
}
