"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { INDUSTRY_SHOWCASE_SCREENS } from "@/constants/marketing-ui-screens";
import { ExpandableScreenshot } from "@/features/marketing/components/expandable-screenshot";
import { LandingSection } from "@/features/marketing/components/landing-section";
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
};

/** Industry section — tabbed preview with POS monitor frame. */
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
    <LandingSection
      id="industries"
      tone="mist"
      className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:gap-12">
          <div>
            <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
              {industries.badge}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0B1220] sm:text-4xl">
              {industries.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-pretty text-[#526174] sm:text-lg">
              {industries.subtitle}
            </p>

            <div
              className="mt-8 flex gap-2 overflow-x-auto pb-2 lg:mt-10 lg:flex-col lg:overflow-visible lg:pb-0"
              role="tablist"
              aria-label="Select an industry"
            >
              {industries.items.map((item) => {
                const selected = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    id={`industry-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`industry-panel-${item.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectIndustry(item.id)}
                    onKeyDown={(event) => {
                      const ids = industries.items.map((entry) => entry.id);
                      const index = ids.indexOf(item.id);
                      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                        event.preventDefault();
                        const next = ids[(index + 1) % ids.length]!;
                        selectIndustry(next);
                        document.getElementById(`industry-tab-${next}`)?.focus();
                      }
                      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                        event.preventDefault();
                        const prev = ids[(index - 1 + ids.length) % ids.length]!;
                        selectIndustry(prev);
                        document.getElementById(`industry-tab-${prev}`)?.focus();
                      }
                    }}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2.5 text-left text-sm font-semibold transition-colors lg:w-full lg:rounded-xl lg:border-b lg:border-transparent lg:px-4",
                      selected
                        ? "bg-[#0B1220] text-white lg:border-transparent"
                        : "border border-slate-200 bg-white text-[#0B1220] hover:border-slate-300 lg:border-0 lg:border-b lg:border-[rgba(11,18,32,0.08)] lg:bg-transparent lg:text-[#526174]",
                    )}
                  >
                    {item.pill}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            id={`industry-panel-${active.id}`}
            role="tabpanel"
            aria-labelledby={`industry-tab-${active.id}`}
            className="overflow-hidden rounded-[20px] border border-[rgba(11,18,32,0.10)] bg-white shadow-[0_24px_60px_-40px_rgba(11,18,32,0.35)]"
          >
            <div className="grid gap-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <h3 className="text-2xl font-semibold tracking-tight text-[#0B1220]">
                  {active.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-[#526174]">{active.detail}</p>
                <ul className="mt-6 space-y-2.5">
                  {active.capabilities.map((capability) => (
                    <li key={capability} className="flex gap-2.5 text-sm text-[#0B1220]">
                      <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {capability}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {active.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              <div className="flex items-center justify-center bg-[#EFF8FF] p-5 sm:p-7 lg:p-8">
                <div key={active.id} className="landing-monitor">
                  <div className="landing-monitor-bezel">
                    <ExpandableScreenshot
                      src={screen}
                      alt={SCREEN_ALT[active.id]}
                      className="landing-industry-shot-frame"
                    >
                      <Image
                        src={screen}
                        alt={SCREEN_ALT[active.id]}
                        fill
                        quality={90}
                        className="landing-industry-shot"
                        sizes="(max-width: 1024px) 100vw, 720px"
                        draggable={false}
                      />
                    </ExpandableScreenshot>
                    <div className="landing-monitor-chin" aria-hidden />
                  </div>
                  <div className="landing-monitor-stand" aria-hidden />
                  <div className="landing-monitor-base" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>

        {industries.items.map((item) => (
          <div key={item.id} id={`industry-${item.id}`} className="sr-only" aria-hidden />
        ))}
      </div>
    </LandingSection>
  );
}
