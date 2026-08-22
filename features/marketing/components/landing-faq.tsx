import {
  ArrowUpRight,
  Database,
  Headset,
  Shield,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { landingCopy } from "@/features/marketing/content";

const TRUST_ICONS = {
  offline: Database,
  data: Shield,
  upgrade: ArrowUpRight,
  support: Headset,
} as const;

/** Section 7 — trust cards + interactive FAQ before final CTA. */
export function LandingFaq() {
  const { trust, faq } = landingCopy;

  return (
    <section
      id="faq"
      className="landing-trust-faq scroll-mt-24 border-t border-border bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[680px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-wide">{trust.badge}</p>
          <h2 className="text-[#111827] mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {trust.title}
          </h2>
          <p className="text-slate-600 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
            {trust.subtitle}
          </p>
        </header>

        <ul
          data-reveal
          className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
        >
          {trust.cards.map((card) => {
            const Icon = TRUST_ICONS[card.id as keyof typeof TRUST_ICONS] ?? Shield;
            return (
              <li
                key={card.id}
                className="landing-trust-card landing-shadow-card group rounded-2xl border border-slate-200/80 bg-white p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/25 sm:p-6"
              >
                <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-[#111827] mt-4 text-base font-semibold tracking-tight">
                  {card.title}
                </h3>
                <p className="text-slate-600 mt-2 text-sm leading-relaxed">{card.detail}</p>
              </li>
            );
          })}
        </ul>

        <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
          <div data-reveal className="text-center sm:text-left">
            <p className="text-primary text-[13px] font-semibold tracking-wide">{faq.badge}</p>
            <h3 className="text-[#111827] mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {faq.title}
            </h3>
          </div>

          <Accordion
            type="single"
            collapsible
            className="landing-faq-accordion landing-shadow-card mt-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-4 sm:mt-10 sm:px-6"
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
        </div>
      </div>
    </section>
  );
}
