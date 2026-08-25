import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
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
        if (
          password.length < 12 ||
          !/[A-Z]/.test(password) ||
          !/[a-z]/.test(password) ||
          !/\d/.test(password)
        ) {
          throw new Error(
            "Password must be at least 12 characters and include uppercase, lowercase, and a number",
          );
        }
      },
    }),
  ],
});
