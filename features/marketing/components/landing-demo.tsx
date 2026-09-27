"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingSection } from "@/features/marketing/components/landing-section";
import { landingCopy } from "@/features/marketing/content";
import { appEntryHref } from "@/lib/hosting/hosts";
import { cn } from "@/lib/utils";

type DemoChapter = (typeof landingCopy.demo.chapters)[number];
type DemoChapterId = DemoChapter["id"];

type PublishedDemoChapter = DemoChapter & { src: string };

function publishedChapters(): PublishedDemoChapter[] {
  return landingCopy.demo.chapters.filter(
    (chapter): chapter is PublishedDemoChapter =>
      chapter.published === true && typeof chapter.src === "string" && chapter.src.length > 0,
  );
}

function parseDemoHash(hash: string): DemoChapterId | null {
  const raw = hash.replace(/^#/, "");
  if (raw === "demo") return null;
  if (!raw.startsWith("demo-")) return null;
  const id = raw.slice("demo-".length) as DemoChapterId;
  return publishedChapters().some((chapter) => chapter.id === id) ? id : null;
}

/**
 * Homepage product demo — activity chapters with CTAs.
 * New walkthroughs: publish `public/marketing/demo/<id>.mp4` and flip
 * `published` on the matching chapter in `landingCopy.demo`.
 */
export function LandingDemo() {
  const { demo } = landingCopy;
  const chapters = publishedChapters();
  const hasComingSoon = demo.chapters.some((chapter) => !chapter.published || !chapter.src);
  const [activeId, setActiveId] = useState<DemoChapterId>(chapters[0]?.id ?? "overview");
  const active = chapters.find((chapter) => chapter.id === activeId) ?? chapters[0];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const signupHref = appEntryHref("/signup");

  useEffect(() => {
    const applyHash = () => {
      const id = parseDemoHash(window.location.hash);
      if (!id) return;
      setActiveId(id);
      requestAnimationFrame(() => {
        document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.src) return;
    video.pause();
    video.load();
  }, [active?.src]);

  function selectChapter(id: DemoChapterId) {
    setActiveId(id);
    const nextHash = id === chapters[0]?.id ? "#demo" : `#demo-${id}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  if (!active) return null;

  return (
    <LandingSection
      id="demo"
      tone="pearl"
      className="overflow-x-clip px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28"
      aria-labelledby="demo-heading"
    >
      <div className="mx-auto w-full min-w-0 max-w-[1240px]">
        <header data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {demo.badge}
          </p>
          <h2
            id="demo-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0B1220] sm:text-4xl"
          >
            {demo.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-[#526174] sm:text-lg">
            {demo.subtitle}
          </p>
        </header>

        {chapters.length > 1 ? (
          <div
            data-reveal
            className="mt-8 flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-10 [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Demo activity"
          >
            {chapters.map((chapter) => {
              const selected = chapter.id === activeId;
              return (
                <button
                  key={chapter.id}
                  id={`demo-tab-${chapter.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`demo-panel-${chapter.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectChapter(chapter.id)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    selected
                      ? "bg-[#0B1220] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-[#0B1220]",
                  )}
                >
                  {chapter.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          data-reveal
          id={`demo-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`demo-tab-${active.id}`}
          className="mt-8 sm:mt-10"
        >
          <div className="landing-demo-stage overflow-hidden rounded-[24px] bg-[#071426] p-2 shadow-[0_24px_48px_-28px_rgba(7,20,38,0.55)] sm:rounded-[28px] sm:p-3">
            <div className="relative aspect-video overflow-hidden rounded-[18px] bg-black sm:rounded-[22px]">
              <video
                key={active.src}
                ref={videoRef}
                className="h-full w-full object-contain"
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload"
              >
                <source src={active.src} type="video/mp4" />
                Your browser does not support embedded video.
              </video>
            </div>
          </div>

          <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-[#526174] sm:text-base">
            {active.description}
          </p>
        </div>

        <div
          data-reveal
          className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center"
        >
          <Button asChild size="lg" className="h-12 rounded-full px-7 text-[15px] font-semibold">
            <Link href={signupHref}>{demo.primaryCta}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-full border-[rgba(11,18,32,0.12)] bg-white px-7 text-[15px] font-semibold text-[#0B1220]"
          >
            <Link href={demo.seriesHref}>{demo.seriesCta}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="h-12 rounded-full px-5 text-[15px] font-semibold text-slate-600"
          >
            <Link href={demo.secondaryHref}>{demo.secondaryCta}</Link>
          </Button>
        </div>

        {hasComingSoon && demo.comingSoonNote ? (
          <p data-reveal className="mt-6 text-center text-sm text-slate-500">
            {demo.comingSoonNote}
          </p>
        ) : null}
      </div>
    </LandingSection>
  );
}
