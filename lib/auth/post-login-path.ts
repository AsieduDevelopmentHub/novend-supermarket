/** Where a signed-in user should land after login (not the marketing page). */
export function postLoginPath(user?: {
  isPlatformAdmin?: boolean | null;
  needsOnboarding?: boolean | null;
  needsProfile?: boolean | null;
} | null): "/platform" | "/onboarding" | "/dashboard" {
  if (user?.isPlatformAdmin) return "/platform";
  if (user?.needsOnboarding || user?.needsProfile) return "/onboarding";
  return "/dashboard";
}
