import { APP_BRAND, APP_NAME, APP_TAGLINE } from "@/constants/app";
import { absoluteUrl, getSiteOrigin } from "./site-url";

export type FaqItem = { q: string; a: string };

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(): JsonLd {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Asiedu Development Hub",
    brand: { "@type": "Brand", name: APP_BRAND },
    url: origin,
    logo: absoluteUrl("/branding/logo_horizontal.png"),
    email: "asiedudev.hub@gmail.com",
    sameAs: [],
    description: `${APP_NAME} — ${APP_TAGLINE}. Commercial offline-first Point of Sale.`,
  };
}

export function softwareApplicationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Windows, macOS, Linux, Android, iOS",
    url: absoluteUrl("/"),
    downloadUrl: absoluteUrl("/download"),
    description:
      "Offline-first Point of Sale for retail, pharmacy, wholesale, and multi-branch businesses. Desktop, Android, and iOS PWA with cloud sync.",
    offers: {
      "@type": "Offer",
      url: absoluteUrl("/pricing"),
      priceCurrency: "GHS",
      availability: "https://schema.org/InStock",
    },
    creator: {
      "@type": "Organization",
      name: "Asiedu Development Hub",
    },
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: absoluteUrl("/"),
    description: `${APP_NAME} — ${APP_TAGLINE}`,
    publisher: {
      "@type": "Organization",
      name: "Asiedu Development Hub",
    },
  };
}

export function faqPageJsonLd(items: readonly FaqItem[], pageUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: pageUrl,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function landingStructuredData(faqItems: readonly FaqItem[]): JsonLd[] {
  return [
    organizationJsonLd(),
    softwareApplicationJsonLd(),
    websiteJsonLd(),
    faqPageJsonLd(faqItems, absoluteUrl("/")),
  ];
}

export function helpStructuredData(faqItems: readonly FaqItem[]): JsonLd[] {
  return [faqPageJsonLd(faqItems, absoluteUrl("/docs/help"))];
}
