"use client";

import { useEffect } from "react";
import { useLicense } from "@/hooks/use-license";
import { DEFAULT_NOVEND_EXPERIENCE } from "@/convex/shared/experience";
import { applyExperienceTokens } from "../apply-experience-tokens";

/**
 * Applies organization experience tokens from the live or cached licence.
 * Prefer mounting {@link OrganizationExperienceRoot} in the app shell so tokens
 * land before interactive paint when a cached licence exists.
 */
export function useOrganizationExperience() {
  const { experience, configVersion, isLoading, fromCache } = useLicense();

  useEffect(() => {
    if (isLoading && !fromCache) return;
    applyExperienceTokens(experience ?? DEFAULT_NOVEND_EXPERIENCE, {
      version: configVersion,
    });
  }, [experience, configVersion, isLoading, fromCache]);

  return {
    experience: experience ?? DEFAULT_NOVEND_EXPERIENCE,
    configVersion,
    isLoading,
    fromCache,
  };
}
