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

/** V3 FAQ — stacked question cards + support card with headset diagram. */
export function LandingFaq() {
  const { faq } = landingCopy;

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-border bg-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[680px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {faq.badge}
          </p>
          <h2 className="text-[#111827] mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {faq.title}
          </h2>
        </header>

        <div className="mt-12 grid gap-6 lg:mt-14 lg:grid-cols-[1.35fr_0.9fr] lg:items-start lg:gap-8">
          <Accordion
            type="single"
            collapsible
            className="flex flex-col gap-3"
            data-reveal
          >
            {faq.items.map((item, index) => (
              <AccordionItem
                key={item.q}
                value={`faq-${index}`}
                className="landing-shadow-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 sm:px-5 data-[state=open]:shadow-md"
              >
                <AccordionTrigger className="group text-[#111827] gap-3 py-4 text-left text-[15px] font-medium hover:no-underline sm:py-5 [&>svg:last-child]:hidden">
                  <span className="pr-2">{item.q}</span>
                  <Plus
                    className="text-slate-400 h-5 w-5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-45"
                    aria-hidden
                  />
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 pb-5 text-sm leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <aside
            data-reveal
            className="landing-faq-support landing-shadow-card relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[#F8FAFC] p-6 sm:p-7 lg:sticky lg:top-28"
          >
            <div className="flex items-end gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-[#111827] text-xl font-semibold tracking-tight sm:text-[1.35rem]">
                  {faq.contactTitle}
                </h3>
                <p className="text-slate-600 mt-2.5 text-sm leading-relaxed">
                  {faq.contactDetail}
                </p>
                <Button asChild className="mt-6 font-semibold">
                  <a href={faq.contactHref}>{faq.contactCta}</a>
                </Button>
              </div>

              <div className="landing-faq-headset shrink-0 self-end">
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
    </section>
  );
}
