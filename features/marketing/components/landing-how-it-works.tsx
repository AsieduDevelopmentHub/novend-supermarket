import Image from "next/image";
import { Cloud, Package, ShoppingCart, Store, Warehouse } from "lucide-react";
import { BRANDING } from "@/constants/branding";
import { landingCopy } from "@/features/marketing/content";
import { LandingSection } from "@/features/marketing/components/landing-section";

const STEP_ICONS = {
  products: Package,
  distribute: Warehouse,
  sell: ShoppingCart,
  sync: Cloud,
} as const;

const DIAGRAM_ICONS = {
  warehouse: Warehouse,
  branch: Store,
  pos: ShoppingCart,
} as const;

/** Floating chip positions over the isometric diagram — desktop / tablet only. */
const FLOAT_POS: Record<(typeof landingCopy.howItWorks.diagramLabels)[number]["id"], string> = {
  warehouse: "left-[4%] top-[6%] lg:left-[8%] lg:top-[10%]",
  branch: "right-[3%] top-[34%] lg:right-[6%] lg:top-[38%]",
  pos: "left-[4%] bottom-[8%] lg:left-[10%] lg:bottom-[12%]",
};

/** V3 how-it-works — steps + diagram with floating Warehouse / Branch / POS labels. */
export function LandingHowItWorks() {
  const { howItWorks } = landingCopy;

  return (
    <LandingSection id="how-it-works" tone="soft" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[680px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {howItWorks.badge}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#111827] sm:text-4xl">
            {howItWorks.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
            {howItWorks.subtitle}
          </p>
        </header>

        <div className="mt-14 grid items-center gap-12 lg:mt-16 lg:grid-cols-2 lg:gap-16">
          <ol data-reveal className="space-y-6 sm:space-y-8">
            {howItWorks.steps.map((step) => {
              const Icon = STEP_ICONS[step.id] ?? Package;
              return (
                <li key={step.id} className="flex gap-4">
                  <span className="bg-primary/12 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-primary text-xs font-bold tracking-[0.16em] uppercase">
                      {step.number}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#111827]">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div
            data-reveal
            className="landing-how-visual relative mx-auto w-full max-w-lg lg:max-w-none"
          >
            <div className="relative">
              <Image
                src={BRANDING.landingHowItWorks}
                alt="Warehouse to branch to POS inventory flow diagram"
                width={1024}
                height={1024}
                className="h-auto w-full object-contain"
                sizes="(max-width: 1024px) 90vw, 520px"
              />

              {/* Overlay floats only from sm up — avoid covering the diagram core on phones */}
              {howItWorks.diagramLabels.map((label) => {
                const Icon = DIAGRAM_ICONS[label.id] ?? Store;
                return (
                  <div
                    key={label.id}
                    className={`landing-how-float absolute z-10 hidden sm:block ${FLOAT_POS[label.id]}`}
                  >
                    <div className="inline-flex max-w-[10.5rem] items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-2.5 py-1.5 shadow-[0_12px_28px_-14px_rgba(15,23,42,0.45)] backdrop-blur-sm md:max-w-[11.5rem] md:px-3 md:py-2">
                      <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full md:h-7 md:w-7">
                        <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 pr-0.5">
                        <p className="text-[11px] font-semibold tracking-tight text-[#111827] md:text-xs">
                          {label.title}
                        </p>
                        <p className="truncate text-[9px] leading-tight text-slate-500 md:text-[10px]">
                          {label.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile: labels sit under the diagram so the core stays clear */}
            <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:hidden">
              {howItWorks.diagramLabels.map((label) => {
                const Icon = DIAGRAM_ICONS[label.id] ?? Store;
                return (
                  <li key={label.id}>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-2 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)]">
                      <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                        <Icon className="h-3 w-3" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-tight text-[#111827]">
                          {label.title}
                        </p>
                        <p className="text-[10px] leading-tight text-slate-500">{label.detail}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
