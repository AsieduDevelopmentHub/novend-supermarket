"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Apple, Download, Monitor, Smartphone, Globe, Loader2 } from "lucide-react";
import { useReleaseOffers } from "@/hooks/use-release-offers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";
import { APP_NAME } from "@/constants/app";
import { detectBrowserDesktopTarget, type BrowserDesktopTarget } from "@/lib/desktop";
import { sanitizeReleaseNoteLines } from "@/features/marketing/lib/sanitize-release-notes";
import { cn } from "@/lib/utils";

let cachedBrowserTarget: BrowserDesktopTarget | null | undefined;

function subscribeNoop() {
  return () => {};
}

function getBrowserTargetSnapshot(): BrowserDesktopTarget | null {
  if (cachedBrowserTarget === undefined) {
    cachedBrowserTarget = detectBrowserDesktopTarget();
  }
  return cachedBrowserTarget;
}

function formatBytes(size?: number) {
  if (size == null || size <= 0) return null;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatReleasedAt(timestamp: number | undefined) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

type InstallerKind = "windows" | "macos" | "linux-deb" | "linux-appimage";

function isSuggested(
  kind: InstallerKind,
  platform: "win32" | "darwin" | "linux",
  target: BrowserDesktopTarget | null,
): boolean {
  if (!target) return false;
  if (target.platform !== platform) return false;
  if (platform === "linux") {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const looksDebian = /Ubuntu|Debian|Linux Mint/i.test(ua);
    return kind === (looksDebian ? "linux-deb" : "linux-appimage");
  }
  return true;
}

const MOBILE_PLATFORM_META = [
  {
    id: "android" as const,
    label: "Android",
    detail: "Native app for phones and tablets.",
    icon: Smartphone,
  },
  {
    id: "ios" as const,
    label: "iPhone & iPad",
    detail: "Add Novend to your Home Screen from Safari as a PWA.",
    icon: Apple,
  },
] as const;

/** Public download hub — live desktop and mobile installers. */
export function DownloadView() {
  const target = useSyncExternalStore(subscribeNoop, getBrowserTargetSnapshot, () => null);
  const preferredArch = target?.arch ?? "x64";
  const {
    desktop: offer,
    mobile: mobileOffer,
    desktopRecent,
    mobileRecent,
  } = useReleaseOffers(preferredArch, { recentLimit: 5 });

  const recent = useMemo(() => {
    const combined = [...(desktopRecent ?? []), ...(mobileRecent ?? [])];
    const byTag = new Map<string, (typeof combined)[number]>();
    for (const entry of combined) {
      const existing = byTag.get(entry.tag);
      if (!existing || entry.releasedAt > existing.releasedAt) {
        byTag.set(entry.tag, entry);
      }
    }
    return [...byTag.values()].sort((a, b) => b.releasedAt - a.releasedAt).slice(0, 5);
  }, [desktopRecent, mobileRecent]);

  const installers = useMemo(() => offer?.installers ?? [], [offer]);
  const releasedLabel = formatReleasedAt(offer?.releasedAt);
  const mobileReleasedLabel = formatReleasedAt(mobileOffer?.releasedAt);
  const loading = offer === undefined;
  const mobileLoading = mobileOffer === undefined;
  const offerHighlights = useMemo(() => sanitizeReleaseNoteLines(offer?.notes), [offer?.notes]);

  return (
    <MarketingSitePage
      badge="Downloads"
      title={`Download ${APP_NAME}`}
      subtitle="Install Novend on the counter PC, download the Android app, or add it to an iPhone Home Screen as a PWA — all from one account."
      maxWidthClassName="max-w-5xl"
      meta={
        offer
          ? `Latest stable ${offer.version}${releasedLabel ? ` · Released ${releasedLabel}` : ""}`
          : undefined
      }
    >
      <div className="space-y-10">
        <section className="landing-shadow-card rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Monitor className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Desktop</h2>
                  <p className="text-sm text-slate-600">
                    Windows, macOS, and Linux — offline-ready with barcode and receipt hardware.
                  </p>
                </div>
              </div>
            </div>
            {offer ? <Badge variant="secondary">v{offer.version}</Badge> : null}
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Checking for the latest version…
            </div>
          ) : offer === null || installers.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6">
              <p className="text-sm font-semibold text-[#111827]">No desktop installers yet</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                A desktop release hasn&apos;t been published yet. You can still use the web app now,
                and installers will appear here automatically after the next update.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/signup">Start free trial on the web</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-8 space-y-3">
              {installers.map((installer) => {
                const suggested = installer.platform
                  ? isSuggested(installer.kind as InstallerKind, installer.platform, target)
                  : false;
                const sizeLabel = formatBytes(installer.size);

                return (
                  <li
                    key={installer.kind}
                    className={cn(
                      "flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
                      suggested && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#111827]">{installer.label}</p>
                        {suggested ? (
                          <Badge variant="outline" className="text-xs">
                            Suggested for this device
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        {installer.description}
                        {sizeLabel ? ` · ${sizeLabel}` : ""}
                        {installer.arch ? ` · ${installer.arch}` : ""}
                      </p>
                    </div>
                    <Button asChild className="shrink-0" size="sm">
                      <a href={installer.url} download>
                        <Download className="mr-2 size-4" aria-hidden />
                        Download
                      </a>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {offerHighlights.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold tracking-wide text-[#111827] uppercase">
                What&apos;s in this release
              </p>
              <ul className="mt-3 space-y-2">
                {offerHighlights.map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm text-slate-600">
                    <span
                      className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section
          id="mobile"
          className="landing-shadow-card rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Smartphone className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Mobile</h2>
                <p className="text-sm text-slate-600">
                  {mobileOffer
                    ? `Android app and iOS Home Screen PWA${mobileReleasedLabel ? ` · Released ${mobileReleasedLabel}` : ""}`
                    : "Android app downloads publish here with each release. iPhone and iPad use a Home Screen PWA today."}
                </p>
              </div>
            </div>
            {mobileOffer ? <Badge variant="secondary">v{mobileOffer.version}</Badge> : null}
          </div>

          {mobileLoading ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading mobile downloads…
            </div>
          ) : (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {MOBILE_PLATFORM_META.map((platform) => {
                const Icon = platform.icon;
                const download = mobileOffer?.downloads[platform.id];
                const storeUrl = mobileOffer?.storeUrls[platform.id];
                const available = Boolean(download?.url || storeUrl);
                const iosPwa = platform.id === "ios" && !available;
                const sizeLabel = formatBytes(download?.size);

                return (
                  <li
                    key={platform.id}
                    className={cn(
                      "rounded-2xl border px-4 py-5",
                      available || iosPwa
                        ? "border-slate-200/80 bg-white"
                        : "border-dashed border-slate-200 bg-slate-50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 shrink-0 text-slate-700" aria-hidden />
                      <p className="min-w-0 flex-1 text-sm font-semibold text-[#111827]">
                        {platform.label}
                      </p>
                      {iosPwa ? (
                        <Badge variant="default">PWA</Badge>
                      ) : !available ? (
                        <Badge variant="outline">Coming soon</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {sizeLabel
                        ? `${platform.detail.replace(/\.$/, "")} · ${sizeLabel}`
                        : platform.detail}
                    </p>
                    {download?.url ? (
                      <Button asChild size="sm" className="mt-4 w-full sm:w-auto">
                        <a href={download.url} download={download.fileName}>
                          <Download className="mr-2 h-4 w-4" aria-hidden />
                          Download APK
                        </a>
                      </Button>
                    ) : storeUrl ? (
                      <Button asChild size="sm" variant="outline" className="mt-4 w-full sm:w-auto">
                        <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                          Open in store
                        </a>
                      </Button>
                    ) : iosPwa ? (
                      <Button asChild size="sm" className="mt-4 w-full sm:w-auto">
                        <Link href="/login">Open in Safari</Link>
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="landing-shadow-card rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Globe className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Web app</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Use Novend in the browser with the same account, catalog, and sync — no installer
                  required.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Start free trial</Link>
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[#111827]">
                Recent updates
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Updated automatically whenever we publish a new version.
              </p>
            </div>
            <Link
              href="/docs/releases"
              className="text-primary text-sm font-semibold hover:underline"
            >
              Full release notes
            </Link>
          </div>

          {desktopRecent === undefined && mobileRecent === undefined ? (
            <p className="mt-4 text-sm text-slate-600">Loading release history…</p>
          ) : recent.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No published releases yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {recent.map((entry) => {
                const highlights = sanitizeReleaseNoteLines(entry.notes);
                return (
                  <li
                    key={entry.tag}
                    className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#111827]">{entry.tag}</p>
                      <Badge variant="secondary" className="text-xs">
                        {entry.channel}
                      </Badge>
                      {entry.mandatory ? (
                        <Badge variant="outline" className="text-xs">
                          Mandatory
                        </Badge>
                      ) : null}
                      <span className="text-xs text-slate-500">
                        {formatReleasedAt(entry.releasedAt)}
                      </span>
                    </div>
                    {highlights.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {highlights.slice(0, 4).map((line) => (
                          <li key={line} className="flex gap-2 text-sm text-slate-600">
                            <span
                              className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                              aria-hidden
                            />
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No release notes attached.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </MarketingSitePage>
  );
}
