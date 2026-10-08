import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getProfileByUserId } from "./shared/permissions";
import { renderWelcomeEmail, welcomeSms } from "./shared/emailTemplates";
import { publicAppUrl, sendTransactionalEmailBestEffort } from "./shared/transactionalEmail";
import { sendArkeselSmsBestEffort } from "./shared/arkeselSms";

/** Claim the one-time welcome and return who to contact. */
export const claim = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await getProfileByUserId(ctx, args.userId);
    if (!profile || profile.welcomedAt !== undefined) return null;
    const organization = await ctx.db.get(profile.organizationId);
    const user = await ctx.db.get(profile.userId);
    await ctx.db.patch(profile._id, { welcomedAt: Date.now() });
    const email = user && typeof user.email === "string" ? user.email.trim() : "";
    return {
      organizationId: profile.organizationId,
      name: profile.name,
      organizationName: organization?.name ?? "your business",
      email,
      phone: profile.phone?.trim() ?? "",
    };
  },
});

/** In-app notice, welcome email, and SMS. Runs after the profile is saved. */
export const deliver = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const target = await ctx.runMutation(internal.welcome.claim, { userId: args.userId });
    if (!target) return;

    await ctx.runMutation(internal.appNotifications.recordWelcome, {
      organizationId: target.organizationId,
      userId: args.userId,
      organizationName: target.organizationName,
    });

    if (target.email) {
      await sendTransactionalEmailBestEffort(
        target.email,
        renderWelcomeEmail({
          name: target.name,
          organizationName: target.organizationName,
          signInUrl: `${publicAppUrl()}/login`,
        }),
        "welcome",
      );
    }

    if (target.phone) {
      await sendArkeselSmsBestEffort({
        to: target.phone,
        message: welcomeSms(
          target.name,
          target.organizationName,
          `${publicAppUrl()}/login`,
        ),
      });
    }
  },
});
