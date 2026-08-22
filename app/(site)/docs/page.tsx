import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CircleHelp, Newspaper } from "lucide-react";
import { MarketingSitePage } from "@/features/marketing/components/marketing-site-page";
import { sitePages } from "@/features/marketing/site-content";
import { APP_BRAND } from "@/constants/app";

export const metadata: Metadata = {
  title: "Documentation",
  description: `Learn how to run ${APP_BRAND} — offline POS, inventory, sync, hardware, and multi-branch operations.`,
};

const QUICK_LINKS = [
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
  {
    href: "/#features",
    title: "Product tour",
    detail: "Browse the complete business platform on the landing page.",
    icon: BookOpen,
  },
] as const;

export default function DocsPage() {
  const page = sitePages.docs;

  return (
    <MarketingSitePage
      badge={page.badge}
      title={page.title}
      subtitle={page.subtitle}
      maxWidthClassName="max-w-5xl"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="landing-shadow-card group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30"
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-[#111827] mt-4 text-base font-semibold tracking-tight">
                  {item.title}
                </span>
                <span className="text-slate-600 mt-1.5 text-sm leading-relaxed">{item.detail}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-12 grid gap-5 sm:mt-14 lg:grid-cols-2">
        {page.sections.map((section) => (
          <article
            key={section.id}
            id={section.id}
            className="landing-shadow-card rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7"
          >
            <h2 className="text-[#111827] text-lg font-semibold tracking-tight">{section.title}</h2>
            <p className="text-slate-600 mt-2 text-sm leading-relaxed">{section.detail}</p>
            <ul className="mt-5 space-y-2.5">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </MarketingSitePage>
  );
}
