import { Headset } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";

/** V3 FAQ — accordion left + contact card right. */
export function LandingFaq() {
  const { faq } = landingCopy;

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-border bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
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

        <div className="mt-12 grid gap-8 lg:mt-14 lg:grid-cols-[1.4fr_0.85fr] lg:items-start lg:gap-10">
          <Accordion
            type="single"
            collapsible
            className="landing-faq-accordion landing-shadow-card overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-4 sm:px-6"
            data-reveal
          >
            {faq.items.map((item, index) => (
              <AccordionItem
                key={item.q}
                value={`faq-${index}`}
                className="border-slate-100 last:border-b-0"
              >
                <AccordionTrigger className="text-[#111827] py-5 text-left text-base font-medium hover:no-underline sm:py-6">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 pb-5 text-sm leading-relaxed sm:pb-6">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <aside
            data-reveal
            className="landing-shadow-card rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 lg:sticky lg:top-28"
          >
            <div className="bg-primary/12 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
              <Headset className="h-6 w-6" aria-hidden />
            </div>
            <h3 className="text-[#111827] mt-5 text-xl font-semibold tracking-tight">
              {faq.contactTitle}
            </h3>
            <p className="text-slate-600 mt-3 text-sm leading-relaxed">{faq.contactDetail}</p>
            <Button asChild className="mt-6 w-full font-semibold sm:w-auto">
              <a href={faq.contactHref}>{faq.contactCta}</a>
            </Button>
          </aside>
        </div>
      </div>
    </section>
  );
}
