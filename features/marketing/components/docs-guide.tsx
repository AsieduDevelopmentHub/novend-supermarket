"use client";

import Image from "next/image";
import Link from "next/link";
import { CircleHelp, Download, Newspaper } from "lucide-react";
import { DOCS_SECTION_DEMOS } from "@/constants/marketing-ui-screens";
import { ExpandableScreenshot } from "@/features/marketing/components/expandable-screenshot";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";
import { sitePages } from "@/features/marketing/site-content";

const QUICK_LINKS = [
  {
    href: "/download",
    title: "Download",
    detail: "Desktop installers, the Android app, and iOS as a Home Screen PWA.",
    icon: Download,
  },
  {
    href: "/docs/help",
    title: "Help Center",
    detail: "Troubleshooting for sales, stock, devices, and plans.",
    icon: CircleHelp,
  },
  {
    href: "/docs/releases",
    title: "Release Notes",
    detail: "See what shipped in the latest Novend versions.",
    icon: Newspaper,
  },
] as const;

/** Illustrated documentation guide with real product UI demos. */
export function DocsGuide() {
  const page = sitePages.docs;

  return (
    <MarketingSitePage
      badge={page.badge}
      title={page.title}
      subtitle={page.subtitle}
      maxWidthClassName="max-w-5xl"
    >
      <ul data-reveal-stagger className="grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="landing-shadow-card group hover:border-primary/30 flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5"
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-4 text-base font-semibold tracking-tight text-[#111827]">
                  {item.title}
                </span>
                <span className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.detail}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <nav
        aria-label="Documentation topics"
        className="mt-10 flex gap-2 overflow-x-auto pb-1 sm:mt-12 sm:flex-wrap sm:overflow-visible"
      >
        {page.sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="hover:border-primary/40 shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:text-[#111827]"
          >
            {section.title}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-10 sm:mt-12 sm:space-y-12">
        {page.sections.map((section, index) => {
          const demos = DOCS_SECTION_DEMOS[section.id] ?? [];
          const imageLeft = index % 2 === 1;

          return (
            <article
              key={section.id}
              id={section.id}
              data-reveal
              className="landing-shadow-card scroll-mt-28 overflow-hidden rounded-3xl border border-slate-200/80 bg-white"
            >
              <div className="grid lg:grid-cols-2">
                <div
                  className={`flex flex-col justify-center p-6 sm:p-8 ${imageLeft ? "lg:order-2" : "lg:order-1"}`}
                >
                  <p className="text-primary text-[11px] font-bold tracking-[0.16em] uppercase">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#111827] sm:text-2xl">
                    {section.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                    {section.detail}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-2.5 text-sm text-slate-700">
                        <span
                          className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className={`border-slate-100 bg-[#0f172a] p-3 sm:p-4 ${
                    imageLeft
                      ? "border-b lg:order-1 lg:border-r lg:border-b-0"
                      : "border-t lg:order-2 lg:border-t-0 lg:border-l"
                  }`}
                >
                  {demos.length === 0 ? (
                    <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50 px-4 text-center text-sm text-slate-400">
                      Demo screens for this topic are coming soon.
                    </div>
                  ) : (
                    <div className={demos.length === 1 ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
                      {demos.map((demo, demoIndex) => (
                        <figure
                          key={demo.src}
                          className={
                            demos.length > 2 && demoIndex === 0
                              ? "min-w-0 sm:col-span-2"
                              : "min-w-0"
                          }
                        >
                          <ExpandableScreenshot
                            src={demo.src}
                            alt={demo.alt}
                            className="landing-docs-shot-frame"
                          >
                            <Image
                              src={demo.src}
                              alt={demo.alt}
                              width={1920}
                              height={1080}
                              quality={90}
                              className="landing-docs-shot"
                              sizes="(max-width: 1024px) 100vw, 480px"
                              draggable={false}
                            />
                          </ExpandableScreenshot>
                          <figcaption className="mt-2 px-0.5 text-center text-[11px] font-medium text-slate-300 sm:text-left">
                            {demo.caption}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </MarketingSitePage>
  );
}
