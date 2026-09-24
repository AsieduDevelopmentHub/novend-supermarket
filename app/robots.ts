import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/lib/seo/public-routes";
import { absoluteUrl, getSiteOrigin } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteOrigin(),
  };
}
