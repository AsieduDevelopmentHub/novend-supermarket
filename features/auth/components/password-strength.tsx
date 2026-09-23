"use client";

import { passwordStrength } from "@/convex/shared/passwordPolicy";
import { cn } from "@/lib/utils";

export function PasswordStrengthMeter({
  password,
  compact = false,
}: {
  password: string;
  compact?: boolean;
}) {
  const strength = passwordStrength(password);
  if (!password) return null;

  const unmet = strength.checks.filter((check) => !check.ok);

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-2")} aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="bg-muted flex h-1.5 flex-1 overflow-hidden rounded-full">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                "h-full flex-1",
                index > 0 && "ml-0.5",
                strength.score > index ? "bg-primary" : "bg-transparent",
              )}
            />
          ))}
        </div>
        <p className="text-muted-foreground w-20 text-right text-xs font-medium">
          {strength.label}
        </p>
      </div>
      {compact ? (
        unmet.length > 0 ? (
          <p className="text-muted-foreground text-xs leading-snug">
            Needed: {unmet.map((check) => check.label).join(" · ")}
          </p>
        ) : null
      ) : (
        <ul className="grid gap-1">
          {strength.checks.map((check) => (
            <li
              key={check.id}
              className={cn("text-xs", check.ok ? "text-foreground" : "text-muted-foreground")}
            >
              {check.ok ? "Ready: " : "Needed: "}
              {check.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
