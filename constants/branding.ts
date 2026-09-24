/** Bump when replacing files under /public/marketing so Next Image + browsers refetch. */
const MARKETING_ASSET_VERSION = "20260924a";

function marketingAsset(path: string): string {
  return `${path}?v=${MARKETING_ASSET_VERSION}`;
}

export const BRANDING = {
  brandmark: "/branding/brandmark.png",
  logoHorizontal: "/branding/logo_horizontal.png",
  logoHorizontalLight: "/branding/logo_horizontal_light.png",
  logoVertical: "/branding/logo_vertical.png",
  loginHero: "/branding/login_hero.png",
  /** Real product dashboard — landing hero & analytics showcase. */
  dashboardHero: marketingAsset("/marketing/dashboard.png"),
  /** V3 landing device / diagram marketing assets (from ui_reference). */
  landingHeroMonitor: marketingAsset("/marketing/v3/hero-shell-empty-no-bg-v4.png"),
  landingHowItWorks: marketingAsset("/marketing/v3/how-it-works-diagram.png"),
  /** Laptop + phone with transparent plate for dark CTA panels. */
  landingCtaDevices: marketingAsset("/marketing/v3/cta-devices-nobg.png"),
  landingFaqHeadset: marketingAsset("/marketing/v3/headset.png"),
} as const;

export const BRAND_TAGLINE = "Smart POS. Strong business.";
