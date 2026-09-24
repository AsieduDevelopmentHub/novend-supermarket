"use client";

import { createContext, useContext, type ReactNode } from "react";
import { publicSiteHref } from "@/lib/hosting/hosts";

const PublicSiteHostContext = createContext<string | null>(null);

/** Request host from a layout that already reads headers(), so public links match on server and client. */
export function PublicSiteHostProvider({
  host,
  children,
}: {
  host: string | null;
  children: ReactNode;
}) {
  return <PublicSiteHostContext.Provider value={host}>{children}</PublicSiteHostContext.Provider>;
}

export function usePublicSiteHref(path: string): string {
  return publicSiteHref(path, useContext(PublicSiteHostContext));
}
