"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginBrandPanel } from "@/features/auth/components/login-brand-panel";
import { LoginAtmosphere } from "@/features/auth/components/login-atmosphere";

function readDesktopViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(min-width: 768px)").matches;
}

/**
 * One LoginForm instance only. Mounting mobile + desktop forms in parallel
 * doubled resolve/nav effects, reset both forms on hard leave, and blanked
 * the visible sheet.
 *
 * Viewport is read synchronously so the form never paints a skeleton sheet.
 */
export function LoginPageChrome() {
  const [desktop, setDesktop] = useState(readDesktopViewport);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  if (!desktop) {
    return (
      <div className="bg-background relative flex max-h-dvh min-h-dvh flex-col overflow-y-auto overscroll-y-contain">
        <LoginBrandPanel variant="mobile" className="h-[min(42dvh,300px)] min-h-[220px] shrink-0" />
        <div className="bg-card relative z-10 -mt-10 flex flex-1 flex-col rounded-t-[1.75rem] px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(15,23,42,0.12)]">
          <LoginForm compact />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background relative flex max-h-dvh min-h-dvh items-center justify-center overflow-hidden p-5 lg:p-8 xl:p-10">
      <LoginAtmosphere />
      <div className="border-border bg-card relative z-10 grid h-[min(620px,calc(100dvh-4rem))] max-h-[calc(100dvh-4rem)] w-full max-w-[960px] grid-cols-[1.05fr_1fr] overflow-hidden rounded-2xl border shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <LoginBrandPanel variant="desktop" className="min-h-0" />
        <div className="min-h-0 overflow-y-auto overscroll-y-contain">
          <div className="flex min-h-full items-center justify-center px-8 py-8 lg:px-12 lg:py-10">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
