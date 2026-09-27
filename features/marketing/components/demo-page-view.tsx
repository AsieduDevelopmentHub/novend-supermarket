"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { appEntryHref } from "@/lib/hosting/hosts";
import { cn } from "@/lib/utils";

type Episode = (typeof landingCopy.demoPage.episodes)[number];
type EpisodeId = Episode["id"];
type PlayableId = typeof landingCopy.demoPage.full.id | EpisodeId;

type Playable = {
  id: PlayableId;
  label: string;
  description: string;
  src: string;
  kind: "full" | "episode";
  order?: number;
};

function parsePlayableHash(hash: string): PlayableId | null {
  const raw = hash.replace(/^#/, "");
  if (!raw || raw === "demo" || raw === "full") return "full";
  const id = (raw.startsWith("episode-") ? raw.slice("episode-".length) : raw) as PlayableId;
  if (id === "full") return "full";
  return landingCopy.demoPage.episodes.some((episode) => episode.id === id)
    ? (id as EpisodeId)
    : null;
}

function resolvePlayable(id: PlayableId): Playable {
  const { demoPage } = landingCopy;
  if (id === "full") {
    return { ...demoPage.full, kind: "full" };
  }
  const episode = demoPage.episodes.find((item) => item.id === id) ?? demoPage.episodes[0]!;
  return { ...episode, kind: "episode" };
}

type ChipProps = {
  selected: boolean;
  label: string;
  badge: string;
  description?: string;
  onSelect: () => void;
  className?: string;
};

function DemoChip({ selected, label, badge, description, onSelect, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-3.5 sm:py-3",
        selected
          ? "border-primary/35 bg-primary/10 text-[#0B1220]"
          : "border-transparent bg-white text-slate-600 hover:border-slate-200 hover:text-[#0B1220]",
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-wide uppercase sm:text-[11px]",
          badge.length > 2 ? "px-2" : "w-6",
          selected ? "bg-[#0B1220] text-white" : "bg-slate-100 text-slate-500",
        )}
      >
        {badge}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight">{label}</span>
        {description ? (
          <span className="mt-0.5 line-clamp-2 hidden text-xs leading-snug text-slate-500 lg:block">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * Demo detail page — complete training is the main video; series is per-action.
 * Mobile: player first, then a compact horizontal episode rail.
 * Deep link: `/demo`, `/demo#full`, `/demo#sales`, `/demo#episode-inventory`.
 */
export function DemoPageView() {
  const { demoPage } = landingCopy;
  const episodes = demoPage.episodes;
  const [activeId, setActiveId] = useState<PlayableId>("full");
  const active = resolvePlayable(activeId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const signupHref = appEntryHref("/signup");

  useEffect(() => {
    const applyHash = () => {
      const id = parsePlayableHash(window.location.hash);
      if (!id) return;
      setActiveId(id);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.load();
  }, [active.src]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const selected = rail.querySelector<HTMLElement>("[aria-current='true']");
    selected?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  function selectPlayable(id: PlayableId) {
    setActiveId(id);
    const nextHash = id === "full" ? "#full" : `#${id}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  return (
    <div className="overflow-x-hidden bg-[#F8FAFC]">
      <section className="border-b border-[rgba(11,18,32,0.08)] bg-gradient-to-b from-[#EFF8FF] to-[#F8FAFC]">
        <div
          data-reveal
          className="mx-auto max-w-[1240px] px-4 py-10 text-center sm:px-6 sm:py-14 lg:px-8 lg:py-16"
        >
          <p className="text-primary text-[12px] font-semibold tracking-[0.14em] uppercase sm:text-[13px]">
            {demoPage.badge}
          </p>
          <h1 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-balance text-[#0B1220] sm:text-4xl lg:text-5xl lg:leading-[1.05]">
            {demoPage.title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-pretty text-[#526174] sm:mt-4 sm:text-lg">
            {demoPage.subtitle}
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:mt-8 sm:flex-row sm:items-center sm:gap-3">
            <Button
              asChild
              size="lg"
              className="h-11 rounded-full px-6 text-[15px] font-semibold sm:h-12 sm:px-7"
            >
              <Link href={signupHref}>{demoPage.primaryCta}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 rounded-full border-slate-300 bg-white px-6 text-[15px] font-semibold sm:h-12 sm:px-7"
            >
              <Link href={demoPage.secondaryHref}>{demoPage.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full min-w-0 max-w-[1240px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          {/* Player first on mobile so the page is usable above the fold */}
          <div data-reveal className="order-1 min-w-0 lg:order-2">
            <div className="overflow-hidden rounded-2xl bg-[#071426] p-1.5 shadow-[0_24px_48px_-28px_rgba(7,20,38,0.55)] sm:rounded-[28px] sm:p-3">
              <div className="relative aspect-video overflow-hidden rounded-[14px] bg-black sm:rounded-[22px]">
                <video
                  key={active.src}
                  ref={videoRef}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  poster={demoPage.poster}
                >
                  <source src={active.src} type="video/mp4" />
                  Your browser does not support embedded video.
                </video>
              </div>
            </div>

            <div className="mt-4 min-w-0 sm:mt-6">
              <p className="text-primary text-[11px] font-semibold tracking-[0.12em] uppercase sm:text-[12px]">
                {active.kind === "full"
                  ? "Complete training"
                  : `Action ${String(active.order).padStart(2, "0")} of ${episodes.length}`}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#0B1220] sm:mt-1.5 sm:text-2xl">
                {active.label}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#526174] sm:mt-2 sm:text-base">
                {active.description}
              </p>
            </div>

            {/* Mobile episode rail — under the player, not above it */}
            <div className="mt-5 lg:hidden">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
                Watch · {episodes.length + 1} videos
              </p>
              <div
                ref={railRef}
                className="mt-2.5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Training videos"
              >
                <DemoChip
                  selected={activeId === "full"}
                  label={demoPage.full.label}
                  badge="Full"
                  onSelect={() => selectPlayable("full")}
                  className="w-max max-w-[11rem] shrink-0"
                />
                {episodes.map((episode) => (
                  <DemoChip
                    key={episode.id}
                    selected={episode.id === activeId}
                    label={episode.label}
                    badge={String(episode.order).padStart(2, "0")}
                    onSelect={() => selectPlayable(episode.id)}
                    className="w-max max-w-[9.5rem] shrink-0"
                  />
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-2.5 border-t border-slate-200/80 pt-6 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:pt-8">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full px-6 text-[15px] font-semibold sm:h-12 sm:px-7"
              >
                <Link href={signupHref}>{demoPage.primaryCta}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 rounded-full border-slate-300 bg-white px-6 text-[15px] font-semibold sm:h-12 sm:px-7"
              >
                <Link href={demoPage.secondaryHref}>{demoPage.secondaryCta}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-11 rounded-full px-4 text-[15px] font-semibold text-slate-600 sm:h-12 sm:px-5"
              >
                <Link href={demoPage.homeTeaserHref}>{demoPage.homeTeaserCta}</Link>
              </Button>
            </div>
          </div>

          {/* Desktop sidebar */}
          <nav
            data-reveal
            aria-label="Training videos"
            className="order-2 hidden min-w-0 lg:order-1 lg:sticky lg:top-28 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-1"
          >
            <p className="text-[12px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
              Main
            </p>
            <div className="mt-3">
              <DemoChip
                selected={activeId === "full"}
                label={demoPage.full.label}
                badge="Full"
                description={demoPage.full.description}
                onSelect={() => selectPlayable("full")}
                className="w-full"
              />
            </div>

            <p className="mt-6 text-[12px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
              {demoPage.episodesLabel} · {episodes.length}
            </p>
            <ol className="mt-3 flex flex-col gap-2">
              {episodes.map((episode) => (
                <li key={episode.id}>
                  <DemoChip
                    selected={episode.id === activeId}
                    label={episode.label}
                    badge={String(episode.order).padStart(2, "0")}
                    description={episode.description}
                    onSelect={() => selectPlayable(episode.id)}
                    className="w-full"
                  />
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>
    </div>
  );
}
