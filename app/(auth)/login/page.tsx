import { LoginForm } from "@/features/auth/components/login-form";
import { LoginHeroPanel } from "@/features/auth/components/login-hero-panel";

export default function LoginPage() {
  return (
    <>
      {/* Mobile — hero photo with form sheet overlapping rounded top corners */}
      <div className="bg-background relative flex max-h-dvh min-h-dvh flex-col overflow-y-auto overscroll-y-contain md:hidden">
        <LoginHeroPanel variant="mobile" className="h-[min(46dvh,340px)] min-h-[240px] shrink-0" />
        <div className="bg-card relative z-10 -mt-10 flex flex-1 flex-col rounded-t-[1.75rem] px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(15,23,42,0.12)]">
          <LoginForm compact />
        </div>
      </div>

      {/* Desktop / tablet — inset panel with breathing room */}
      <div className="bg-background hidden max-h-dvh min-h-dvh items-center justify-center overflow-y-auto p-5 md:flex lg:p-8 xl:p-10">
        <div className="border-border bg-card grid w-full max-w-6xl overflow-hidden rounded-2xl border shadow-[var(--shadow-lg)] md:min-h-[min(640px,calc(100dvh-4rem))] md:grid-cols-2">
          <LoginHeroPanel
            variant="desktop"
            className="hidden min-h-[min(640px,calc(100dvh-4rem))] md:block"
          />
          <div className="flex items-center justify-center overflow-y-auto px-8 py-12 lg:px-14 xl:px-16">
            <LoginForm />
          </div>
        </div>
      </div>
    </>
  );
}
