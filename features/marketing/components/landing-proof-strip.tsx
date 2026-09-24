import { Building2, Lock, MonitorSmartphone, WifiOff, type LucideIcon } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";

const ICONS: Record<(typeof landingCopy.proofStrip.items)[number]["id"], LucideIcon> = {
  offline: WifiOff,
  branches: Building2,
  platforms: MonitorSmartphone,
  backup: Lock,
};

/** Proof strip — plain capability row with dividers (brief §3A.3). */
export function LandingProofStrip() {
  const { proofStrip } = landingCopy;

  return (
    <section aria-label="Platform strengths" className="bg-white">
      <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <ul className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-[rgba(11,18,32,0.10)] lg:grid-cols-4">
          {proofStrip.items.map((item, index) => {
            const Icon = ICONS[item.id];
            return (
              <li
                key={item.id}
                className={`flex items-center gap-3 px-4 py-5 sm:px-6 sm:py-6 ${
                  index % 2 === 1 ? "border-l border-[rgba(11,18,32,0.10)]" : ""
                } ${index >= 2 ? "border-t border-[rgba(11,18,32,0.10)] lg:border-t-0" : ""} ${
                  index >= 1 ? "lg:border-l lg:border-[rgba(11,18,32,0.10)]" : "lg:border-l-0"
                }`}
              >
                <Icon className="text-primary h-5 w-5 shrink-0" aria-hidden />
                <span className="text-sm font-semibold tracking-tight text-[#0B1220]">
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
