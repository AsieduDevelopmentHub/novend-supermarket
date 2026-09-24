import { LandingSection } from "@/features/marketing/components/landing-section";
import { landingCopy } from "@/features/marketing/content";

/**
 * Transparent product-research section — used until verified customer proof exists.
 * Do not invent testimonials, logos, or metrics here.
 */
export function LandingResearchProof() {
  const { researchProof } = landingCopy;

  return (
    <LandingSection id="proof" tone="pearl" className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div data-reveal className="mx-auto max-w-3xl text-center">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-amber-700 uppercase">
          {researchProof.eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-[#0F172A] sm:text-3xl">
          {researchProof.title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
          {researchProof.detail}
        </p>
      </div>
    </LandingSection>
  );
}
