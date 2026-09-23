import { LoginForm } from "@/features/auth/components/login-form";
import { LoginBrandPanel } from "@/features/auth/components/login-brand-panel";
import { LoginAtmosphere } from "@/features/auth/components/login-atmosphere";
import { LoginSessionGate } from "@/features/auth/components/login-session-gate";

/**
 * Login — mobile hero + overlapping sheet, desktop split card.
 * Session gate replaces the whole chrome while an existing session resumes.
 */
export default function LoginPage() {
  return (
    <LoginSessionGate>
      {/* Mobile — brand hero with form sheet overlapping rounded top */}
      <div className="bg-background relative flex max-h-dvh min-h-dvh flex-col overflow-y-auto overscroll-y-contain md:hidden">
        <LoginBrandPanel variant="mobile" className="h-[min(42dvh,300px)] min-h-[220px] shrink-0" />
        <div className="bg-card relative z-10 -mt-10 flex flex-1 flex-col rounded-t-[1.75rem] px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(15,23,42,0.12)]">
          <LoginForm compact />
        </div>
      </div>

      {/* Desktop / tablet — inset panel */}
      <div className="bg-background relative hidden max-h-dvh min-h-dvh items-center justify-center overflow-hidden p-5 md:flex lg:p-8 xl:p-10">
        <LoginAtmosphere />
        <div className="border-border bg-card relative z-10 grid max-h-full w-full max-w-[960px] overflow-hidden rounded-2xl border shadow-[0_20px_50px_rgba(15,23,42,0.08)] md:h-[min(620px,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:grid-cols-[1.05fr_1fr]">
          <LoginBrandPanel variant="desktop" className="hidden min-h-0 md:block" />
          <div className="min-h-0 overflow-y-auto overscroll-y-contain">
            <div className="flex min-h-full items-center justify-center px-8 py-8 lg:px-12 lg:py-10">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </LoginSessionGate>
  );
}
