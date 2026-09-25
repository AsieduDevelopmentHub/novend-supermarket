import { landingCopy } from "@/features/marketing/content";
import { cn } from "@/lib/utils";

/** Dark offline-first technical story panel (brief §3A.5). */
export function LandingOfflineFlow() {
  const { offlineFlow } = landingCopy;

  return (
    <section
      id="offline-sync"
      className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="overflow-hidden rounded-[24px] bg-[#071426] px-5 py-16 text-white sm:rounded-[32px] sm:px-10 sm:py-20 lg:px-14 lg:py-24">
          <header data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
              {offlineFlow.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
              {offlineFlow.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-pretty text-slate-300 sm:text-lg">
              {offlineFlow.detail}
            </p>
          </header>

          <ol
            data-reveal-stagger
            className="relative mt-12 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
          >
            <div
              className="pointer-events-none absolute top-[2.75rem] right-[8%] left-[8%] hidden h-px bg-gradient-to-r from-transparent via-[#38BDF8]/50 to-transparent lg:block"
              aria-hidden
            />
            {offlineFlow.steps.map((step, index) => (
              <li
                key={step.id}
                className={cn(
                  "relative rounded-[20px] border border-white/10 p-5 sm:p-6",
                  index === 1 ? "bg-[#0D1C31]" : "bg-[#0A1628]/90",
                )}
              >
                <span className="text-primary/90 text-xs font-semibold tracking-[0.16em] uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 text-base font-semibold tracking-tight text-white">
                  {step.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.detail}</p>
              </li>
            ))}
          </ol>

          <div
            data-reveal
            className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-[16px] border border-white/10 bg-[#0A1628]/80 px-4 py-3 text-sm text-slate-300"
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
              {offlineFlow.statusStrip.operational}
            </span>
            <span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden />
            <span>{offlineFlow.statusStrip.queue}</span>
            <span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden />
            <span>{offlineFlow.statusStrip.connected}</span>
          </div>

          <p
            data-reveal
            className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-slate-500"
          >
            {offlineFlow.qualification}
          </p>
        </div>
      </div>
    </section>
  );
}
