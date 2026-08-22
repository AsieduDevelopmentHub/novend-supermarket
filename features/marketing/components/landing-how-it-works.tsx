import Image from "next/image";
import {
  Cloud,
  Package,
  ShoppingCart,
  Store,
  Warehouse,
} from "lucide-react";
import { BRANDING } from "@/constants/branding";
import { landingCopy } from "@/features/marketing/content";

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

/** Floating chip positions over the isometric diagram (percent of visual). */
const FLOAT_POS: Record<(typeof landingCopy.howItWorks.diagramLabels)[number]["id"], string> = {
  warehouse: "left-[8%] top-[10%]",
  branch: "right-[6%] top-[38%]",
  pos: "left-[10%] bottom-[12%]",
};

/** V3 how-it-works — steps + diagram with floating Warehouse / Branch / POS labels. */
export function LandingHowItWorks() {
  const { howItWorks } = landingCopy;

  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-border bg-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[680px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {howItWorks.badge}
          </p>
          <h2 className="text-[#111827] mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {howItWorks.title}
          </h2>
          <p className="text-slate-600 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
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
                    <h3 className="text-[#111827] mt-1 text-lg font-semibold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-slate-600 mt-1.5 text-sm leading-relaxed">{step.detail}</p>
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

              {howItWorks.diagramLabels.map((label) => {
                const Icon = DIAGRAM_ICONS[label.id] ?? Store;
                return (
                  <div
                    key={label.id}
                    className={`landing-how-float absolute z-10 ${FLOAT_POS[label.id]}`}
                  >
                    <div className="inline-flex max-w-[11.5rem] items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-3 py-2 shadow-[0_12px_28px_-14px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                      <span className="bg-primary text-primary-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 pr-0.5">
                        <p className="text-[#111827] text-xs font-semibold tracking-tight">
                          {label.title}
                        </p>
                        <p className="text-slate-500 truncate text-[10px] leading-tight">
                          {label.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
