import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, type ConvexCredentialsConfig } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { GENERIC_LOGIN_ERROR, normalizeLoginDeviceKey } from "./shared/loginRateLimit";
import { assertPasswordPolicy } from "./shared/passwordPolicy";

const passwordProvider = Password<DataModel>({
  profile: (params) => {
    const email = String(params.email ?? "")
      .trim()
      .toLowerCase();
    if (!email) {
      throw new Error("Email is required");
    }
    const name = String(params.name ?? "").trim() || email.split("@")[0];
    return { email, name };
  },
  validatePasswordRequirements: (password) => {
    assertPasswordPolicy(password);
  },
});

const passwordOptions = (
  passwordProvider as unknown as {
    options: ConvexCredentialsConfig;
  }
).options;
const authorizePassword = passwordOptions.authorize;

passwordOptions.authorize = async (params, ctx) => {
  if (params.flow !== "signIn") {
    return await authorizePassword(params, ctx);
  }

  const email = String(params.email ?? "")
    .trim()
    .toLowerCase();
  const deviceKey = normalizeLoginDeviceKey(params.deviceKey);
  const decision = await ctx.runMutation(internal.loginGuards.beginCredentialAttempt, {
    purpose: "login",
    email,
    deviceKey,
    now: Date.now(),
  });
  if (!decision.allowed) {
    throw new Error(GENERIC_LOGIN_ERROR);
  }
  if (decision.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
  }

  try {
    const result = await authorizePassword(params, ctx);
    if (!result) {
      throw new Error(GENERIC_LOGIN_ERROR);
    }
    await ctx.runMutation(internal.loginGuards.clearCredentialFailures, {
      purpose: "login",
      email,
    });
    return result;
  } catch {
    throw new Error(GENERIC_LOGIN_ERROR);
  }
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [passwordProvider],
  // Convex Auth's default hard lock is account-only, so anyone who knows an
  // email can trigger it. The provider wrapper above owns lockouts instead.
  signIn: { maxFailedAttempsPerHour: Number.MAX_SAFE_INTEGER },
});
