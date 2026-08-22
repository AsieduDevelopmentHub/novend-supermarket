import type { Metadata } from "next";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${APP_BRAND} by Asiedu Development Hub.`,
};

export default function TermsPage() {
  const page = sitePages.terms;

  return (
    <MarketingSitePage
      badge={page.badge}
      title={page.title}
      subtitle={page.intro}
      meta={page.effective}
    >
      <div className="space-y-8">
        {page.sections.map((section) => (
          <section key={section.title} className="scroll-mt-28">
            <h2 className="text-[#111827] text-lg font-semibold tracking-tight sm:text-xl">
              {section.title}
            </h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-slate-600 text-sm leading-relaxed sm:text-[15px]">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MarketingSitePage>
  );
}
