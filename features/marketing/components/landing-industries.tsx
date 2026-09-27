"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { INDUSTRY_SHOWCASE_SCREENS } from "@/constants/marketing-ui-screens";
import { ExpandableScreenshot } from "@/features/marketing/components/expandable-screenshot";
import { LandingSection } from "@/features/marketing/components/landing-section";
import { landingCopy } from "@/features/marketing/content";
import { appEntryHref } from "@/lib/hosting/hosts";
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
  restaurant: "Novend POS checkout for restaurant menu items",
  hotel: "Novend POS checkout for hotel room rates",
};

/** Industry section — tabbed preview with POS monitor frame. Mobile-first stacked layout. */
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
      className="overflow-x-clip px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28"
    >
      <div className="mx-auto w-full min-w-0 max-w-[1240px]">
        <header data-reveal className="max-w-2xl">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {industries.badge}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0B1220] sm:text-4xl">
            {industries.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-[#526174] sm:text-lg">
            {industries.subtitle}
          </p>
        </header>

        <div
          data-reveal
          className="landing-industry-pills mt-8 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-10 [&::-webkit-scrollbar]:hidden"
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
                  "shrink-0 snap-start rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                  selected
                    ? "bg-[#0B1220] text-white"
                    : "border border-slate-200 bg-white text-[#0B1220] hover:border-slate-300",
                )}
              >
                {item.pill}
              </button>
            );
          })}
        </div>

        <div
          data-reveal
          id={`industry-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`industry-tab-${active.id}`}
          className="mt-6 min-w-0 overflow-hidden rounded-[20px] border border-[rgba(11,18,32,0.10)] bg-white shadow-[0_24px_60px_-40px_rgba(11,18,32,0.35)] sm:mt-8"
        >
          <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="order-2 flex min-w-0 flex-col justify-center p-5 sm:p-8 lg:order-1 lg:p-10">
              <h3 className="text-xl font-semibold tracking-tight text-[#0B1220] sm:text-2xl">
                {active.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#526174] sm:text-base">
                {active.detail}
              </p>
              <ul className="mt-5 space-y-2.5 sm:mt-6">
                {active.capabilities.map((capability) => (
                  <li
                    key={capability}
                    className="flex gap-2.5 text-sm leading-snug text-[#0B1220]"
                  >
                    <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0">{capability}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={appEntryHref("/signup")}
                className="text-primary mt-6 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline sm:mt-7"
              >
                {active.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="order-1 flex min-h-0 min-w-0 items-center justify-center bg-[#EFF8FF] p-4 sm:min-h-[320px] sm:p-8 lg:order-2 lg:min-h-[440px] lg:p-10">
              <div key={active.id} className="landing-monitor w-full max-w-[20rem] sm:max-w-[28rem] lg:max-w-none">
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
                      sizes="(max-width: 640px) 88vw, (max-width: 1024px) 70vw, 720px"
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

        {industries.items.map((item) => (
          <div key={item.id} id={`industry-${item.id}`} className="sr-only" aria-hidden />
        ))}
      </div>
    </LandingSection>
  );
}
