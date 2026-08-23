"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";
import { sanitizeReleaseNoteLines } from "@/features/marketing/lib/sanitize-release-notes";
import { sitePages } from "@/features/marketing/site-content";

function formatReleasedAt(timestamp: number | undefined) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

/** Release notes from the same live feed as Downloads. */
export function ReleasesView() {
  const page = sitePages.releases;
  const recent = useQuery(api.desktopReleases.listPublicRecent, {
    channel: "stable",
    limit: 20,
  });

  return (
    <MarketingSitePage badge={page.badge} title={page.title} subtitle={page.subtitle}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4">
        <p className="text-slate-600 text-sm leading-relaxed">
          These notes update automatically from the same release feed as{" "}
          <Link href="/download" className="text-primary font-medium hover:underline">
            Downloads
          </Link>
          .
        </p>
        <Button asChild size="sm" className="shrink-0 font-semibold">
          <Link href="/download">Go to downloads</Link>
        </Button>
      </div>

      {recent === undefined ? (
        <div className="text-slate-600 flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading release notes…
        </div>
      ) : recent.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-[#111827] text-base font-semibold">No published releases yet</p>
          <p className="text-slate-600 mx-auto mt-2 max-w-md text-sm leading-relaxed">
            When a new version is published, notes will appear here automatically — matching the
            Download page.
          </p>
          <Button asChild className="mt-5" size="sm">
            <Link href="/download">Check downloads</Link>
          </Button>
        </div>
      ) : (
        <ol className="space-y-5">
          {recent.map((entry) => {
            const highlights = sanitizeReleaseNoteLines(entry.notes);
            return (
              <li
                key={entry.tag}
                className="landing-shadow-card rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-bold tracking-wide">
                    {entry.tag.startsWith("v") ? entry.tag : `v${entry.version}`}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {entry.channel}
                  </Badge>
                  {entry.mandatory ? (
                    <Badge variant="outline" className="text-xs">
                      Mandatory
                    </Badge>
                  ) : null}
                  <span className="text-slate-500 text-sm">
                    {formatReleasedAt(entry.releasedAt) ?? "Date pending"}
                  </span>
                </div>
                <h2 className="text-[#111827] mt-4 text-xl font-semibold tracking-tight">
                  {entry.tag}
                </h2>
                {highlights.length > 0 ? (
                  <ul className="mt-5 space-y-2.5">
                    {highlights.map((item) => (
                      <li key={item} className="flex gap-2.5 text-sm text-slate-700">
                        <span
                          className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 mt-4 text-sm">No release notes attached.</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </MarketingSitePage>
  );
}
