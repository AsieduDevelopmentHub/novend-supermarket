import { LoginAtmosphere } from "@/features/auth/components/login-atmosphere";

/**
 * Product motion backdrop — reuses login mesh, sparklines, and commerce orbs.
 * No lifestyle photography.
 */
export function LandingAtmosphere({ className }: { className?: string }) {
  return (
    <div className={className ?? "landing-atmosphere-frame"} aria-hidden>
      <LoginAtmosphere />
    </div>
  );
}
