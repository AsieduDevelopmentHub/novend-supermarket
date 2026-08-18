import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: (params) => {
        const flow = String((params as { flow?: string }).flow ?? "");
        if (flow === "signUp") {
          throw new Error(
            "Public registration is closed. Ask your administrator for an account.",
          );
        }
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        if (!email) {
          throw new Error("Email is required");
        }
        return { email };
      },
    }),
  ],
});
