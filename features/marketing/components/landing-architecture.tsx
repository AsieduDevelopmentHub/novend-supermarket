import { ArrowRight } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";

/** Business-friendly data path — no framework/vendor names. */
export function LandingArchitecture() {
  return (
    <section
      id="architecture"
      className="scroll-mt-24 border-t border-border bg-card px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold tracking-wide">
            {landingCopy.architecture.eyebrow}
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.architecture.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.architecture.subtitle}
          </p>
        </div>

        <ol
          data-reveal
          className="mt-14 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-3"
        >
          {landingCopy.architecture.flow.map((node, index) => (
            <li key={node.id} className="flex flex-1 items-stretch gap-3">
              <div className="border-border bg-background flex flex-1 flex-col rounded-2xl border p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <span className="text-primary text-[11px] font-bold tracking-[0.14em] uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-foreground mt-3 text-lg font-semibold tracking-tight">
                  {node.label}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{node.detail}</p>
              </div>
              {index < landingCopy.architecture.flow.length - 1 ? (
                <ArrowRight
                  className="text-primary/70 hidden h-5 w-5 shrink-0 self-center lg:block"
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
