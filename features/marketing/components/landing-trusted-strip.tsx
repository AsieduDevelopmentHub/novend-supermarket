import { landingCopy } from "@/features/marketing/content";

/** Slim grayscale name row — industry / partner-style trust strip. */
export function LandingTrustedStrip() {
  return (
    <section className="border-border border-y bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-xs font-medium tracking-wide text-slate-500">
          {landingCopy.trustedBy.title}
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
          {landingCopy.trustedBy.names.map((name) => (
            <li
              key={name}
              className="text-sm font-semibold tracking-tight text-slate-400 grayscale sm:text-base"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
