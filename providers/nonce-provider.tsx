"use client";

import { createContext, useContext, type ReactNode } from "react";

const NonceContext = createContext<string | undefined>(undefined);

/**
 * Request CSP nonce for dynamic app/auth trees.
 * Root layout stays free of `headers()` so marketing can stay static-friendly.
 */
export function NonceProvider({
  nonce,
  children,
}: {
  nonce?: string;
  children: ReactNode;
}) {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>;
}

export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
