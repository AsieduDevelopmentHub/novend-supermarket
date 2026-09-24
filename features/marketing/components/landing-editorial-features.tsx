import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FEATURE_BLOCK_SCREENS } from "@/constants/marketing-ui-screens";
import { ExpandableScreenshot } from "@/features/marketing/components/expandable-screenshot";
import { LandingSection } from "@/features/marketing/components/landing-section";
import { landingCopy } from "@/features/marketing/content";
import { cn } from "@/lib/utils";

const SCREEN_SRC = {
  checkout: FEATURE_BLOCK_SCREENS.checkout,
  inventory: FEATURE_BLOCK_SCREENS.wholesale,
  reports: FEATURE_BLOCK_SCREENS.analytics,
} as const;

const SCREEN_ALT = {
  checkout: "Novend checkout with cart, barcode-ready catalog, and payment controls",
  inventory: "Novend wholesale inventory and branch stock overview",
  reports: "Novend analytics overview with revenue and inventory insights",
} as const;

/** Three outcome-led editorial feature sections — not a card grid. */
export function LandingEditorialFeatures() {
  const { editorial } = landingCopy;

  return (
    <div id="product">
      {editorial.map((block, index) => {
        const imageLeft = index % 2 === 1;
        const tone = index % 2 === 0 ? "pearl" : "soft";
        const src = SCREEN_SRC[block.id];
        const alt = SCREEN_ALT[block.id];

        return (
          <LandingSection
            key={block.id}
            id={block.anchor}
            tone={tone}
            className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28"
          >
            <div
              className={cn(
                "mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16",
              )}
              data-reveal-pair
            >
              <div className={cn(imageLeft ? "lg:order-2" : "lg:order-1")} data-reveal={imageLeft ? "right" : "left"}>
                <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
                  {block.eyebrow}
                </p>
                <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-balance text-[#0F172A] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
                  {block.title}
                </h2>
                <p className="mt-4 max-w-[38rem] text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
                  {block.detail}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {block.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex gap-2.5 text-sm leading-relaxed text-slate-700 sm:text-[15px]"
                    >
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/90"
                        aria-hidden
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link
                  href={block.linkHref}
                  className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {block.linkLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              <div
                className={cn(imageLeft ? "lg:order-1" : "lg:order-2")}
                data-reveal={imageLeft ? "left" : "right"}
              >
                <ExpandableScreenshot
                  src={src}
                  alt={alt}
                  className="overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)]"
                >
                  <Image
                    src={src}
                    alt={alt}
                    width={1440}
                    height={900}
                    className="h-auto w-full object-cover object-top"
                    sizes="(max-width: 1024px) 92vw, 560px"
                  />
                </ExpandableScreenshot>
              </div>
            </div>
          </LandingSection>
        );
      })}
    </div>
  );
}
