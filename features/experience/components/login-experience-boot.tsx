"use client";

import { useLayoutEffect } from "react";
import { DEFAULT_NOVEND_EXPERIENCE } from "@/convex/shared/experience";
import { applyExperienceTokens } from "@/features/experience/apply-experience-tokens";
import { loadOfflineLicenseState } from "@/lib/offline/license";
import { listOfflineSessions } from "@/lib/offline/session";

/**
 * Auth routes sit outside the app shell, so OrganizationExperienceRoot is not
 * mounted. Re-apply the last cached org experience (if any) so login chrome
 * matches the till branding remote staff already know.
 */
export function LoginExperienceBoot() {
  useLayoutEffect(() => {
    let cancelled = false;
    void loadOfflineLicenseState().then((state) => {
      if (cancelled) return;
      const experience = state.snapshot?.experience ?? null;
      if (experience) {
        applyExperienceTokens(experience, {
          version: state.snapshot?.configVersion ?? 0,
        });
        return;
      }
      // No licence cache yet — still mark that at least one offline shell exists
      // so we do not thrash defaults when the form remounts.
      if (listOfflineSessions().length === 0) {
        applyExperienceTokens(DEFAULT_NOVEND_EXPERIENCE, { version: 0 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
