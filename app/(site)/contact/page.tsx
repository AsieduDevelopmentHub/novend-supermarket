import type { Metadata } from "next";
import { ContactPageView } from "@/features/marketing/components/contact-page-view";
import { APP_BRAND, APP_NAME } from "@/constants/app";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact",
  description: `Contact ${APP_NAME} by email, phone, or WhatsApp. Join the Novend community and connect with Asiedu Development Hub. ${APP_BRAND}.`,
  path: "/contact",
});

export default function ContactPage() {
  return <ContactPageView />;
}
