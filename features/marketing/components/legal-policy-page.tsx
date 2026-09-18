import type { Metadata } from "next";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";

type LegalSection = {
  title: string;
  paragraphs: readonly string[];
};

type LegalPageContent = {
  badge: string;
  title: string;
  effective: string;
  intro: string;
  sections: readonly LegalSection[];
};

type LegalPolicyPageProps = {
  content: LegalPageContent;
  metadataTitle: string;
  metadataDescription: string;
};

export function legalMetadata(title: string, description: string): Metadata {
  return { title, description };
}

export function LegalPolicyPage({ content }: Pick<LegalPolicyPageProps, "content">) {
  return (
    <MarketingSitePage
      badge={content.badge}
      title={content.title}
      subtitle={content.intro}
      meta={content.effective}
    >
      <div className="space-y-8">
        {content.sections.map((section) => (
          <section key={section.title} className="scroll-mt-28">
            <h2 className="text-lg font-semibold tracking-tight text-[#111827] sm:text-xl">
              {section.title}
            </h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-sm leading-relaxed text-slate-600 sm:text-[15px]"
                >
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
