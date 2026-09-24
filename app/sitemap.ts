import type { MetadataRoute } from "next";
import { INDEXABLE_ROUTES } from "@/lib/seo/public-routes";
import { absoluteUrl } from "@/lib/seo/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return INDEXABLE_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
