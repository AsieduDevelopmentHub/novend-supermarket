import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailView } from "@/features/marketing/components/product-detail-view";
import {
  getProductPage,
  PRODUCT_PAGE_SLUGS,
  type ProductPageSlug,
} from "@/features/marketing/product-pages";
import { APP_BRAND } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return PRODUCT_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getProductPage(slug);
  if (!page) {
    return buildPageMetadata({
      title: "Product",
      description: `Novend product overview. ${APP_BRAND}.`,
      path: "/product",
    });
  }
  return buildPageMetadata({
    title: page.title,
    description: page.summary,
    path: `/product/${page.slug}`,
  });
}

export default async function ProductSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = getProductPage(slug);
  if (!page) notFound();
  return <ProductDetailView page={page} />;
}

export type { ProductPageSlug };
