import type { Metadata } from "next";
import { APP_BRAND, APP_NAME, APP_TAGLINE } from "@/constants/app";
import { BRANDING } from "@/constants/branding";
import { absoluteUrl, getSiteOrigin } from "./site-url";

const DEFAULT_DESCRIPTION =
  "Commercial offline-first Point of Sale for independent businesses — multi-branch inventory, desktop, Android, and iOS PWA.";

const DEFAULT_KEYWORDS = [
  "POS",
  "point of sale",
  "offline POS",
  "Novend",
  "retail software",
  "inventory management",
  "multi-branch POS",
  "Ghana POS",
  "pharmacy POS",
  "wholesale POS",
];

export type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  /** Open Graph type — landing uses website; articles can use article later. */
  type?: "website" | "article";
  index?: boolean;
  follow?: boolean;
  imagePath?: string;
  /** Skip the root `%s · Novend POS` title template. */
  absoluteTitle?: boolean;
};

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const url = absoluteUrl(input.path);
  const imagePath = input.imagePath ?? BRANDING.ogImage;
  const imageUrl = absoluteUrl(imagePath.split("?")[0] ?? imagePath);
  const index = input.index !== false;
  const follow = input.follow !== false;
  const ogType = input.type ?? "website";
  const title = input.absoluteTitle ? { absolute: input.title } : input.title;

  return {
    title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      type: ogType,
      url,
      siteName: APP_NAME,
      title: input.title,
      description: input.description,
      locale: "en_GB",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${APP_BRAND} — ${APP_TAGLINE}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [imageUrl],
    },
    robots: {
      index,
      follow,
      googleBot: { index, follow },
    },
  };
}

/** Root layout defaults — pages override title/description via buildPageMetadata. */
export function buildRootMetadata(): Metadata {
  const origin = getSiteOrigin();
  const imageUrl = absoluteUrl(BRANDING.ogImage);

  return {
    metadataBase: new URL(origin),
    title: {
      default: APP_NAME,
      template: `%s · ${APP_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: APP_NAME,
    keywords: DEFAULT_KEYWORDS,
    authors: [{ name: "Asiedu Development Hub" }],
    creator: "Asiedu Development Hub",
    publisher: "Asiedu Development Hub",
    category: "business",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.png", type: "image/png" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: APP_NAME,
      statusBarStyle: "default",
    },
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      locale: "en_GB",
      title: `${APP_NAME} — ${APP_TAGLINE}`,
      description: DEFAULT_DESCRIPTION,
      url: absoluteUrl("/"),
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${APP_BRAND} — ${APP_TAGLINE}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${APP_NAME} — ${APP_TAGLINE}`,
      description: DEFAULT_DESCRIPTION,
      images: [imageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

export function buildAppShellMetadata(): Metadata {
  return {
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}
