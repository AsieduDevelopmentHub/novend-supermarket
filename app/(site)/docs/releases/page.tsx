import type { Metadata } from "next";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata: Metadata = {
  title: "Release Notes",
  description: `Product updates and release notes for ${APP_BRAND}.`,
};

export default function ReleasesPage() {
  const page = sitePages.releases;

  return (
    <MarketingSitePage badge={page.badge} title={page.title} subtitle={page.subtitle}>
      <ol className="space-y-5">
        {page.entries.map((entry) => (
          <li
            key={entry.version}
            className="landing-shadow-card rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-bold tracking-wide">
                v{entry.version}
              </span>
              <span className="text-slate-500 text-sm">{entry.date}</span>
            </div>
            <h2 className="text-[#111827] mt-4 text-xl font-semibold tracking-tight">
              {entry.title}
            </h2>
            <ul className="mt-5 space-y-2.5">
              {entry.highlights.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </MarketingSitePage>
  );
}
