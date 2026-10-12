"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";
import { sanitizeReleaseNoteLines } from "@/lib/sanitize-release-notes";
import { sitePages } from "@/features/marketing/site-content";

function formatReleasedAt(timestamp: number | undefined) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

type PublicReleaseRow = {
  version: string;
  tag: string;
  channel: string;
  notes?: string | null;
  releasedAt: number;
  mandatory: boolean;
};

type MergedRelease = PublicReleaseRow & {
  surfaces: Array<"Desktop" | "Android">;
};

/** One card per version — desktop and Android share the same product notes. */
function mergePublicReleases(
  desktop: ReadonlyArray<PublicReleaseRow> | undefined,
  mobile: ReadonlyArray<PublicReleaseRow> | undefined,
  limit: number,
): MergedRelease[] {
  const byTag = new Map<string, MergedRelease>();

  const ingest = (rows: ReadonlyArray<PublicReleaseRow> | undefined, surface: "Desktop" | "Android") => {
    for (const row of rows ?? []) {
      const existing = byTag.get(row.tag);
      if (!existing) {
        byTag.set(row.tag, { ...row, surfaces: [surface] });
        continue;
      }
      if (!existing.surfaces.includes(surface)) {
        existing.surfaces.push(surface);
      }
      // Prefer the richer notes blob and the later publish time.
      if ((row.notes?.length ?? 0) > (existing.notes?.length ?? 0)) {
        existing.notes = row.notes;
      }
      if (row.releasedAt > existing.releasedAt) {
        existing.releasedAt = row.releasedAt;
      }
      existing.mandatory = existing.mandatory || row.mandatory;
    }
  };

  ingest(desktop, "Desktop");
  ingest(mobile, "Android");

  return [...byTag.values()].sort((a, b) => b.releasedAt - a.releasedAt).slice(0, limit);
}

/** Release notes from the same live desktop + Android feeds as Downloads. */
export function ReleasesView() {
  const page = sitePages.releases;
  const desktopRecent = useQuery(api.desktopReleases.listPublicRecent, {
    channel: "stable",
    limit: 20,
  });
  const mobileRecent = useQuery(api.mobileReleases.listPublicRecent, {
    channel: "stable",
    limit: 20,
  });
  const recent = useMemo(
    () => mergePublicReleases(desktopRecent, mobileRecent, 20),
    [desktopRecent, mobileRecent],
  );
  const loading = desktopRecent === undefined || mobileRecent === undefined;

  return (
    <MarketingSitePage badge={page.badge} title={page.title} subtitle={page.subtitle}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4">
        <p className="text-sm leading-relaxed text-slate-600">
          Highlights from recent Novend updates. For installers, visit{" "}
          <Link href="/download" className="text-primary font-medium hover:underline">
            Downloads
          </Link>
          .
        </p>
        <Button asChild size="sm" className="shrink-0 font-semibold">
          <Link href="/download">Go to downloads</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading release notes…
        </div>
      ) : recent.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-base font-semibold text-[#111827]">No published releases yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            When a new version is published, friendly highlights appear here automatically and match
            the Download page.
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
                  {entry.surfaces.map((surface) => (
                    <Badge key={surface} variant="secondary">
                      {surface}
                    </Badge>
                  ))}
                  {entry.mandatory ? <Badge variant="outline">Required update</Badge> : null}
                  <span className="text-sm text-slate-500">
                    {formatReleasedAt(entry.releasedAt) ?? "Date pending"}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-[#111827]">
                  {entry.tag.startsWith("v") ? entry.tag : `v${entry.version}`}
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
                  <p className="mt-4 text-sm text-slate-500">No release notes attached.</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </MarketingSitePage>
  );
}
