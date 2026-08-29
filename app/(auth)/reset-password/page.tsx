import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { LoginBrandPanel } from "@/features/auth/components/login-brand-panel";
import { LoginAtmosphere } from "@/features/auth/components/login-atmosphere";

export default function ResetPasswordPage() {
  return (
    <>
      <div className="bg-background relative flex max-h-dvh min-h-dvh flex-col overflow-y-auto overscroll-y-contain md:hidden">
        <LoginBrandPanel variant="mobile" className="h-[min(42dvh,300px)] min-h-[220px] shrink-0" />
        <div className="bg-card relative z-10 -mt-10 flex flex-1 flex-col rounded-t-[1.75rem] px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(15,23,42,0.12)]">
          <ResetPasswordForm />
        </div>
      </div>

      <div className="bg-background relative hidden max-h-dvh min-h-dvh items-center justify-center overflow-y-auto p-5 md:flex lg:p-8 xl:p-10">
        <LoginAtmosphere />
        <div className="border-border bg-card relative z-10 grid w-full max-w-[960px] overflow-hidden rounded-2xl border shadow-[0_20px_50px_rgba(15,23,42,0.08)] md:min-h-[min(620px,calc(100dvh-4rem))] md:grid-cols-[1.05fr_1fr]">
          <LoginBrandPanel variant="desktop" className="hidden min-h-full md:block" />
          <div className="flex items-center justify-center overflow-y-auto px-8 py-12 lg:px-12">
            <ResetPasswordForm />
          </div>
        </div>
      </div>
    </>
  );
}
