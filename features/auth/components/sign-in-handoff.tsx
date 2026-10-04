"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type SignInHandoffApi = {
  /** Dashboard (or another destination) has something real to show. */
  release: () => void;
};

const SignInHandoffContext = createContext<SignInHandoffApi | null>(null);

/** Lets the destination drop the sign-in cover once it has something to show. */
export function SignInHandoffProvider({
  release,
  children,
}: {
  release: () => void;
  children: ReactNode;
}) {
  const api = useMemo<SignInHandoffApi>(() => ({ release }), [release]);
  return <SignInHandoffContext.Provider value={api}>{children}</SignInHandoffContext.Provider>;
}

export function useSignInHandoff(): SignInHandoffApi | null {
  return useContext(SignInHandoffContext);
}
