"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { INDUSTRY_SHOWCASE_SCREENS } from "@/constants/marketing-ui-screens";
import { ExpandableScreenshot } from "@/features/marketing/components/expandable-screenshot";
import { landingCopy } from "@/features/marketing/content";
import { cn } from "@/lib/utils";

type IndustryId = (typeof landingCopy.industries.items)[number]["id"];

const INDUSTRY_IDS = new Set(landingCopy.industries.items.map((item) => item.id));

function parseIndustryHash(hash: string): IndustryId | null {
  const raw = hash.replace(/^#/, "");
  if (!raw.startsWith("industry-")) return null;
  const id = raw.slice("industry-".length);
  return INDUSTRY_IDS.has(id as IndustryId) ? (id as IndustryId) : null;
}

const SCREEN_ALT: Record<IndustryId, string> = {
  pharmacy: "Novend pharmacy POS sale screen with medicine catalog and cart",
  supermarket: "Novend supermarket POS with product grid and cart",
  wholesale: "Novend wholesale POS with pack pricing and bulk cart",
  fashion: "Novend fashion boutique POS with apparel catalog",
  electronics: "Novend electronics store POS with high-value SKUs",
  convenience: "Novend convenience store POS with quick-scan checkout",
};

/** V3 industries — icon tabs + copy/bullets left + screenshot right. */
export function LandingIndustries() {
  const { industries } = landingCopy;
  const [activeId, setActiveId] = useState<IndustryId>(industries.items[0]!.id);
  const active = industries.items.find((item) => item.id === activeId) ?? industries.items[0]!;
  const screen = INDUSTRY_SHOWCASE_SCREENS[active.id];

  useEffect(() => {
    const applyHash = () => {
      const id = parseIndustryHash(window.location.hash);
      if (!id) return;
      setActiveId(id);
      requestAnimationFrame(() => {
        document.getElementById("industries")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  function selectIndustry(id: IndustryId) {
    setActiveId(id);
    const nextHash = `#industry-${id}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  return (
    <section
      id="industries"
      className="border-border scroll-mt-24 border-t bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[700px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {industries.badge}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#111827] sm:text-4xl">
            {industries.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
            {industries.subtitle}
          </p>
        </header>

        <div
          data-reveal
          className="mt-10 flex gap-2 overflow-x-auto pb-2 sm:mt-12 sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0"
          role="tablist"
          aria-label="Select an industry"
        >
          {industries.items.map((item) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                id={`industry-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectIndustry(item.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-300",
                  selected
                    ? "border-primary bg-primary text-white shadow-[0_8px_20px_-12px_rgba(56,189,248,0.8)]"
                    : "border-slate-200 bg-white text-[#111827] hover:border-slate-300",
                )}
              >
                {item.pill}
              </button>
            );
          })}
        </div>

        <div
          data-reveal
          className="landing-shadow-card mt-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white sm:mt-10"
        >
          <div className="grid lg:grid-cols-2">
            <div
              key={`copy-${active.id}`}
              className="order-2 flex flex-col justify-center p-6 sm:p-8 lg:order-1 lg:p-10"
            >
              <h3 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                {active.title}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-slate-600">{active.detail}</p>
              <ul className="mt-6 space-y-2.5">
                {active.capabilities.map((capability) => (
                  <li key={capability} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="bg-primary/12 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    </span>
                    {capability}
                  </li>
                ))}
              </ul>
              <a
                href="#how-it-works"
                className="bg-primary text-primary-foreground mt-8 inline-flex w-fit items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                {active.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>

            <div className="order-1 border-b border-slate-100 bg-[#0f172a] p-3 sm:p-4 lg:order-2 lg:border-b-0 lg:border-l">
              <div key={active.id} className="landing-industry-visual">
                <ExpandableScreenshot
                  src={screen}
                  alt={SCREEN_ALT[active.id]}
                  className="landing-industry-shot-frame"
                >
                  <Image
                    src={screen}
                    alt={SCREEN_ALT[active.id]}
                    width={1920}
                    height={1080}
                    quality={90}
                    className="landing-industry-shot"
                    sizes="(max-width: 1024px) 100vw, 560px"
                    draggable={false}
                  />
                </ExpandableScreenshot>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
