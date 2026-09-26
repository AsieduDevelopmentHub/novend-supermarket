import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";
import { JsonLd, buildPageMetadata, helpStructuredData, type FaqItem } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Help Center",
  description: `Get help with ${APP_BRAND} sales, inventory, devices, and plans.`,
  path: "/docs/help",
});

function helpFaqItems(): FaqItem[] {
  return sitePages.help.categories.flatMap((category) =>
    category.items.map((item) => ({ q: item.q, a: item.a })),
  );
}

export default function HelpCenterPage() {
  const page = sitePages.help;
  const faqItems = helpFaqItems();

  return (
    <>
      <JsonLd data={helpStructuredData(faqItems)} />
      <MarketingSitePage badge={page.badge} title={page.title} subtitle={page.subtitle}>
        <div className="space-y-8">
          {page.categories.map((category) => (
            <section
              key={category.title}
              className="landing-shadow-card overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-4 sm:px-6"
            >
              <h2 className="border-b border-slate-100 py-5 text-lg font-semibold tracking-tight text-[#111827]">
                {category.title}
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {category.items.map((item, index) => (
                  <AccordionItem
                    key={item.q}
                    value={`${category.title}-${index}`}
                    className="border-slate-100 last:border-b-0"
                  >
                    <AccordionTrigger className="py-5 text-left text-base font-medium text-[#111827] hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-sm leading-relaxed text-slate-600">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>

        <aside className="landing-shadow-card mt-10 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-[#111827]">
            {page.supportCta.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{page.supportCta.detail}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={page.supportCta.pageHref}>{page.supportCta.pageLabel}</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={page.supportCta.mailto}>Email support</a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/docs">Browse documentation</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-500">{page.supportCta.email}</p>
        </aside>
      </MarketingSitePage>
    </>
  );
}
