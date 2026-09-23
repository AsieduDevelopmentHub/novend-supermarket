"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { FEATURE_BLOCK_SCREENS } from "@/constants/marketing-ui-screens";
import { ExpandableScreenshot } from "@/features/marketing/components/expandable-screenshot";
import { landingCopy } from "@/features/marketing/content";
import { cn } from "@/lib/utils";

const BLOCK_ALT: Record<(typeof landingCopy.features.blocks)[number]["id"], string> = {
  checkout: "Novend POS checkout with product grid, cart, and payment actions",
  inventory: "Novend inventory stock table with quantities, SKUs, and low-stock alerts",
  wholesale: "Novend wholesale warehouse with branch stock and valuation",
  analytics: "Novend analytics dashboard with KPIs, charts, and best sellers",
  reports: "Novend business reports with export and print options",
};

/** Section 4 — alternating product capability showcase with real UI screens. */
export function LandingFeatures() {
  const { features } = landingCopy;

  return (
    <section
      id="features"
      className="landing-features-showcase border-border scroll-mt-24 border-t bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[680px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-wide">{features.badge}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#111827] sm:text-4xl">
            {features.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
            {features.subtitle}
          </p>
        </header>

        <div className="mt-14 flex flex-col gap-16 sm:mt-20 sm:gap-24 lg:gap-28">
          {features.blocks.map((block, index) => {
            const imageLeft = index % 2 === 1;
            // Image and copy slide toward each other (collision).
            const imageReveal = imageLeft ? "left" : "right";
            const copyReveal = imageLeft ? "right" : "left";

            return (
              <article
                key={block.id}
                data-reveal-pair
                className="landing-feature-block grid items-center gap-8 lg:grid-cols-2 lg:gap-14 xl:gap-16"
              >
                <div
                  data-reveal={imageReveal}
                  className={cn("order-1", imageLeft ? "lg:order-1" : "lg:order-2")}
                >
                  <FeatureVisual
                    blockId={block.id}
                    alt={BLOCK_ALT[block.id]}
                    animateCharts={block.id === "analytics"}
                  />
                </div>

                <div
                  data-reveal={copyReveal}
                  className={cn(
                    "order-2 max-w-xl",
                    imageLeft ? "lg:order-2" : "lg:order-1",
                    imageLeft ? "lg:justify-self-start" : "lg:justify-self-end",
                  )}
                >
                  <h3 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                    {block.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-slate-600">{block.detail}</p>
                  <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {block.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <span className="bg-primary/12 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                          <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                        </span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type FeatureVisualProps = {
  blockId: (typeof landingCopy.features.blocks)[number]["id"];
  alt: string;
  animateCharts?: boolean;
};

function FeatureVisual({ blockId, alt, animateCharts = false }: FeatureVisualProps) {
  const screen = FEATURE_BLOCK_SCREENS[blockId];

  return (
    <ExpandableScreenshot
      src={screen}
      alt={alt}
      className={cn(
        "landing-feature-frame landing-shadow-card",
        animateCharts && "landing-feature-frame-charts",
      )}
    >
      <Image
        src={screen}
        alt={alt}
        width={1920}
        height={1080}
        quality={100}
        unoptimized
        className="landing-feature-shot"
        sizes="(max-width: 1024px) 100vw, 640px"
        draggable={false}
      />
      {blockId === "reports" ? (
        <div className="landing-feature-export-chip" aria-hidden>
          <span>PDF</span>
          <span>Excel</span>
          <span>CSV</span>
          <span>Print</span>
        </div>
      ) : null}
    </ExpandableScreenshot>
  );
}
