import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { landingCopy } from "@/features/marketing/content";

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div data-reveal>
          <p className="text-primary text-sm font-semibold tracking-wide">{landingCopy.faq.eyebrow}</p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.faq.title}
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-10" data-reveal>
          {landingCopy.faq.items.map((item, index) => (
            <AccordionItem key={item.q} value={`faq-${index}`} className="border-border">
              <AccordionTrigger className="text-foreground py-5 text-left text-base font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 text-sm leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
