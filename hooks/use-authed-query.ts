"use client";

import { useConvexAuth, useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";

/**
 * `useQuery` for tenant / platform data that requires a Convex session.
 *
 * Skips until Convex reports a JWT. An offline shell that regains the radio has
 * connectivity but no session — subscribing then makes `requireRole` throw
 * `Unauthenticated` during render, which replaced the Connect-to-cloud prompt
 * with the "Something went wrong" error boundary.
 *
 * Use plain `useQuery` only for public queries or ones that return a safe value
 * when signed out (`users.me`, `platform.me`, release offers).
 */
export function useAuthedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const { isAuthenticated } = useConvexAuth();
  const gatedArgs = (isAuthenticated ? args : ["skip"]) as OptionalRestArgsOrSkip<Query>;
  return useQuery(query, ...gatedArgs);
}
