import { LoginForm } from "@/features/auth/components/login-form";
import { LoginBrandPanel } from "@/features/auth/components/login-brand-panel";

export default function LoginPage() {
  return (
    <div className="bg-background flex max-h-dvh min-h-dvh items-center justify-center overflow-y-auto p-4 sm:p-6 lg:p-10">
      <div className="border-border bg-card grid w-full max-w-[960px] overflow-hidden rounded-2xl border shadow-[var(--shadow-lg)] md:min-h-[min(620px,calc(100dvh-5rem))] md:grid-cols-[1.05fr_1fr]">
        <LoginBrandPanel compact className="md:hidden" />
        <LoginBrandPanel className="hidden md:block" />
        <div className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
