import { ArrowRight } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";

/** Offline architecture on dark Onyx — business-friendly, no vendor names. */
export function LandingArchitecture() {
  return (
    <section
      id="architecture"
      className="scroll-mt-24 bg-[#111827] px-4 py-20 text-white sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[#38BDF8] text-sm font-semibold tracking-wide">
            {landingCopy.architecture.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.architecture.title}
          </h2>
          <p className="mt-4 text-base text-slate-300 text-pretty sm:text-lg">
            {landingCopy.architecture.subtitle}
          </p>
        </div>

        <ol
          data-reveal
          className="mt-10 flex flex-col gap-3 sm:mt-14 sm:gap-4 lg:flex-row lg:items-stretch lg:gap-3"
        >
          {landingCopy.architecture.flow.map((node, index) => (
            <li key={node.id} className="flex flex-1 items-stretch gap-3">
              <div className="landing-shadow-onyx flex flex-1 flex-col rounded-[1.25rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <span className="text-[#38BDF8] text-[11px] font-bold tracking-[0.14em] uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{node.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{node.detail}</p>
              </div>
              {index < landingCopy.architecture.flow.length - 1 ? (
                <ArrowRight
                  className="hidden h-5 w-5 shrink-0 self-center text-[#38BDF8]/80 lg:block"
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ol>

        <ul className="mt-10 flex flex-wrap justify-center gap-3 sm:mt-14">
          {landingCopy.architecture.benefits.map((benefit) => (
            <li
              key={benefit}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200"
            >
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
