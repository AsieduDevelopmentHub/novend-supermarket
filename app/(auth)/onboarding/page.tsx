import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { LoginBrandPanel } from "@/features/auth/components/login-brand-panel";
import { LoginAtmosphere } from "@/features/auth/components/login-atmosphere";

export default function OnboardingPage() {
  return (
    <>
      <div className="bg-background relative flex max-h-dvh min-h-dvh flex-col overflow-y-auto overscroll-y-contain md:hidden">
        <LoginBrandPanel variant="mobile" className="h-[min(36dvh,260px)] min-h-[200px] shrink-0" />
        <div className="bg-card relative z-10 -mt-10 flex flex-1 flex-col rounded-t-[1.75rem] px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(15,23,42,0.12)]">
          <OnboardingForm />
        </div>
      </div>

      <div className="bg-background relative hidden max-h-dvh min-h-dvh items-center justify-center overflow-hidden p-5 md:flex lg:p-8 xl:p-10">
        <LoginAtmosphere />
        <div className="border-border bg-card relative z-10 grid max-h-full w-full max-w-[960px] overflow-hidden rounded-2xl border shadow-[0_20px_50px_rgba(15,23,42,0.08)] md:h-[min(620px,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:grid-cols-[1.05fr_1fr]">
          <LoginBrandPanel variant="desktop" className="hidden min-h-0 md:block" />
          <div className="min-h-0 overflow-y-auto overscroll-y-contain">
            <div className="flex min-h-full items-center justify-center px-8 py-8 lg:px-12 lg:py-10">
              <OnboardingForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
