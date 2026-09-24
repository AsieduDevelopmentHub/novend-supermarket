"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { useLicense } from "@/hooks/use-license";
import { DEFAULT_NOVEND_EXPERIENCE } from "@/convex/shared/experience";
import { applyExperienceTokens } from "../apply-experience-tokens";

type Props = {
  children: ReactNode;
};

/**
 * Applies org experience CSS variables on documentElement as early as possible
 * (useLayoutEffect) using the live or offline-cached licence snapshot.
 */
export function OrganizationExperienceRoot({ children }: Props) {
  const { experience, configVersion } = useLicense();

  useLayoutEffect(() => {
    applyExperienceTokens(experience ?? DEFAULT_NOVEND_EXPERIENCE, {
      version: configVersion,
    });
  }, [experience, configVersion]);

  return <>{children}</>;
}
