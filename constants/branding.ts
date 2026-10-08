/** Bump when replacing files under /public/branding so Next Image + browsers refetch. */
const BRAND_ASSET_VERSION = "20260926a";
/** Bump when replacing files under /public/marketing so Next Image + browsers refetch. */
const MARKETING_ASSET_VERSION = "20260926b";

function brandAsset(path: string): string {
  return `${path}?v=${BRAND_ASSET_VERSION}`;
}

function marketingAsset(path: string): string {
  return `${path}?v=${MARKETING_ASSET_VERSION}`;
}

export const BRANDING = {
  brandmark: brandAsset("/branding/brandmark.png"),
  logoHorizontal: brandAsset("/branding/logo_horizontal.png"),
  logoHorizontalLight: brandAsset("/branding/logo_horizontal_light.png"),
  logoVertical: brandAsset("/branding/logo_vertical.png"),
  loginHero: brandAsset("/branding/login_hero.png"),
  /** 1200×630 link-preview image. The mark sits in the center so crops keep it whole. */
  ogImage: "/branding/og.png",
  /** Real product dashboard — landing hero & analytics showcase. */
  dashboardHero: marketingAsset("/marketing/dashboard.png"),
  /** V3 landing device / diagram marketing assets (from ui_reference). */
  landingHeroMonitor: marketingAsset("/marketing/v3/hero-shell-empty-no-bg-v4.png"),
  landingHowItWorks: marketingAsset("/marketing/v3/how-it-works-diagram.png"),
  /**
   * Laptop + phone with live product UI (black studio cutout).
   */
  landingCtaDevices: marketingAsset("/marketing/v3/actual-cta-devices.png"),
  landingFaqHeadset: marketingAsset("/marketing/v3/headset.png"),
} as const;

export const BRAND_TAGLINE = "Smart POS. Strong business.";
