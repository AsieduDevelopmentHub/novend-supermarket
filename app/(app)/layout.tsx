import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildAppShellMetadata } from "@/lib/seo/metadata";
import AppLayoutClient from "./app-layout-client";

export const metadata: Metadata = buildAppShellMetadata();

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
