import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  badge: string;
  title: string;
  subtitle?: string;
  meta?: string;
  children: ReactNode;
  maxWidthClassName?: string;
};

/** Editorial page frame for public docs/legal — Onyx type, Candy Blue accent. */
export function MarketingSitePage({
  badge,
  title,
  subtitle,
  meta,
  children,
  maxWidthClassName = "max-w-3xl",
}: Props) {
  return (
    <div className={`mx-auto ${maxWidthClassName} px-4 sm:px-6 lg:px-8`}>
      <Link
        href="/"
        className="hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Novend
      </Link>

      <header className="mt-8 border-b border-slate-200/80 pb-8">
        <p className="text-primary text-[13px] font-semibold tracking-wide">{badge}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#111827] sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
            {subtitle}
          </p>
        ) : null}
        {meta ? <p className="mt-3 text-sm text-slate-500">{meta}</p> : null}
      </header>

      <div className="py-10 sm:py-12">{children}</div>
    </div>
  );
}
