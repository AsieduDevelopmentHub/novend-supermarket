/** Bump when replacing files under /public/marketing so Next Image + browsers refetch. */
const MARKETING_ASSET_VERSION = "20260924d";

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
  /**
   * Empty laptop + phone shells on a dark plate (white rim dents / highlights).
   * CTA CSS matches that plate, then gradients into the onyx panel.
   */
  landingCtaDevices: marketingAsset("/marketing/v3/cta-devices-empty.png"),
  landingFaqHeadset: marketingAsset("/marketing/v3/headset.png"),
} as const;

export const BRAND_TAGLINE = "Smart POS. Strong business.";
