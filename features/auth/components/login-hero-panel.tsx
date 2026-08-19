import Image from "next/image";
import { BRANDING } from "@/constants/branding";
import { cn } from "@/lib/utils";

type Props = {
  /** Mobile uses a shorter hero under the overlapping form sheet; desktop is full-panel. */
  variant?: "desktop" | "mobile";
  className?: string;
};

/**
 * Photography hero. Desktop keeps a short caption; mobile is image-only.
 */
export function LoginHeroPanel({ variant = "desktop", className }: Props) {
  const isMobile = variant === "mobile";

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={BRANDING.loginHero}
        alt=""
        fill
        priority
        sizes={isMobile ? "100vw" : "50vw"}
        className={cn(
          "object-cover brightness-[1.08]",
          isMobile ? "object-[center_28%]" : "object-[center_35%]",
        )}
      />

      {/* Full-frame wash: brighter top → clear mid → dark bottom for caption */}
      <div
        className={cn(
          "absolute inset-0",
          isMobile
            ? "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.14)_0%,transparent_32%,rgba(0,0,0,0.22)_72%,rgba(0,0,0,0.5)_100%)]"
            : "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.16)_0%,transparent_30%,rgba(0,0,0,0.18)_62%,rgba(0,0,0,0.58)_100%)]",
        )}
      />

      {!isMobile ? (
        <div className="absolute inset-x-0 bottom-0 z-10 p-8 lg:p-10">
          <p className="max-w-sm text-sm leading-relaxed tracking-wide text-white/90">
            Smart POS. Strong business.
          </p>
        </div>
      ) : null}
    </div>
  );
}
