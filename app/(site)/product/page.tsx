import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PRODUCT_PAGES } from "@/features/marketing/product-pages";
import { APP_BRAND, APP_NAME } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Product",
  description: `Explore ${APP_NAME} modules — POS, inventory, branches, reports, and offline sync. ${APP_BRAND}.`,
  path: "/product",
});

export default function ProductIndexPage() {
  const pages = Object.values(PRODUCT_PAGES);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
          Product
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#0B1220] sm:text-4xl">
          One system for the counter and the warehouse
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#526174] sm:text-lg">
          Choose a module to see the operational outcome, workflow, and offline behavior.
        </p>
      </header>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <li key={page.slug}>
            <Link
              href={`/product/${page.slug}`}
              className="hover:border-primary/35 flex h-full flex-col rounded-[20px] border border-[rgba(11,18,32,0.10)] bg-white p-6 transition-colors"
            >
              <p className="text-primary text-[12px] font-semibold tracking-[0.12em] uppercase">
                {page.eyebrow}
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-[#0B1220]">
                {page.title}
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#526174]">{page.summary}</p>
              <span className="text-primary mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
                View details
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
