"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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

/**
 * Demo detail page — complete training is the main video; series is per-action.
 * Deep link: `/demo`, `/demo#full`, `/demo#sales`, `/demo#episode-inventory`.
 */
export function DemoPageView() {
  const { demoPage } = landingCopy;
  const episodes = demoPage.episodes;
  const [activeId, setActiveId] = useState<PlayableId>("full");
  const active = resolvePlayable(activeId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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

  function selectPlayable(id: PlayableId) {
    setActiveId(id);
    const nextHash = id === "full" ? "#full" : `#${id}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  return (
    <div className="bg-[#F8FAFC]">
      <section className="border-b border-[rgba(11,18,32,0.08)] bg-gradient-to-b from-[#EFF8FF] to-[#F8FAFC]">
        <div
          data-reveal
          className="mx-auto max-w-[1240px] px-4 py-12 text-center sm:px-6 sm:py-14 lg:px-8 lg:py-16"
        >
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {demoPage.badge}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0B1220] sm:text-4xl lg:text-5xl lg:leading-[1.05]">
            {demoPage.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-pretty text-[#526174] sm:text-lg">
            {demoPage.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-[15px] font-semibold">
              <Link href={signupHref}>{demoPage.primaryCta}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-slate-300 bg-white px-7 text-[15px] font-semibold"
            >
              <Link href={demoPage.secondaryHref}>{demoPage.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <nav
            data-reveal
            aria-label="Training videos"
            className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-1"
          >
            <p className="text-[12px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
              Main
            </p>
            <div className="mt-3">
              <button
                type="button"
                aria-current={activeId === "full" ? "true" : undefined}
                onClick={() => selectPlayable("full")}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                  activeId === "full"
                    ? "border-primary/35 bg-primary/10 text-[#0B1220]"
                    : "border-transparent bg-white text-slate-600 hover:border-slate-200 hover:text-[#0B1220]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-bold tracking-wide uppercase",
                    activeId === "full"
                      ? "bg-[#0B1220] text-white"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  Full
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-tight">
                    {demoPage.full.label}
                  </span>
                  <span className="mt-0.5 line-clamp-2 hidden text-xs leading-snug text-slate-500 lg:block">
                    {demoPage.full.description}
                  </span>
                </span>
              </button>
            </div>

            <p className="mt-6 text-[12px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
              {demoPage.episodesLabel} · {episodes.length}
            </p>
            <ol className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {episodes.map((episode) => {
                const selected = episode.id === activeId;
                return (
                  <li key={episode.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => selectPlayable(episode.id)}
                      className={cn(
                        "flex w-full min-w-[11.5rem] items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors lg:min-w-0",
                        selected
                          ? "border-primary/35 bg-primary/10 text-[#0B1220]"
                          : "border-transparent bg-white text-slate-600 hover:border-slate-200 hover:text-[#0B1220]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                          selected
                            ? "bg-[#0B1220] text-white"
                            : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {String(episode.order).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold tracking-tight">
                          {episode.label}
                        </span>
                        <span className="mt-0.5 line-clamp-2 hidden text-xs leading-snug text-slate-500 lg:block">
                          {episode.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div data-reveal className="min-w-0">
            <div className="overflow-hidden rounded-[24px] bg-[#071426] p-2 shadow-[0_24px_48px_-28px_rgba(7,20,38,0.55)] sm:rounded-[28px] sm:p-3">
              <div className="relative aspect-video overflow-hidden rounded-[18px] bg-black sm:rounded-[22px]">
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

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 max-w-2xl">
                <p className="text-primary text-[12px] font-semibold tracking-[0.12em] uppercase">
                  {active.kind === "full"
                    ? "Complete training"
                    : `Action ${String(active.order).padStart(2, "0")} of ${episodes.length}`}
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#0B1220]">
                  {active.label}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#526174] sm:text-base">
                  {active.description}
                </p>
              </div>
              <div className="relative hidden h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-slate-200 sm:block">
                <Image
                  src={demoPage.poster}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="128px"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200/80 pt-8 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-[15px] font-semibold">
                <Link href={signupHref}>{demoPage.primaryCta}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-slate-300 bg-white px-7 text-[15px] font-semibold"
              >
                <Link href={demoPage.secondaryHref}>{demoPage.secondaryCta}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-12 rounded-full px-5 text-[15px] font-semibold text-slate-600"
              >
                <Link href={demoPage.homeTeaserHref}>{demoPage.homeTeaserCta}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
