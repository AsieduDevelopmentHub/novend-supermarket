import { landingCopy } from "@/features/marketing/content";

/** Slim grayscale name row — industry / partner-style trust strip. */
export function LandingTrustedStrip() {
  return (
    <section className="border-border bg-white border-y px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-slate-500 text-xs font-medium tracking-wide">
          {landingCopy.trustedBy.title}
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
          {landingCopy.trustedBy.names.map((name) => (
            <li
              key={name}
              className="text-slate-400 text-sm font-semibold tracking-tight grayscale sm:text-base"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
