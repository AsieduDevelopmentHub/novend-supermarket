import { landingCopy } from "@/features/marketing/content";

/** Subtle industry trust strip — no fake company logos. */
export function LandingTrustedStrip() {
  return (
    <section className="border-border bg-[#F8FAFC] border-t px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          {landingCopy.trustedBy.title}
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {landingCopy.trustedBy.industries.map((name) => (
            <li
              key={name}
              className="text-foreground/70 text-sm font-medium tracking-tight sm:text-base"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
