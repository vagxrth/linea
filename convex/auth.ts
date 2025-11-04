import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { internal } from "./_generated/api";
 
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google, Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      // Only create subscription if this is a new user (not an update)
      if (args.existingUserId === undefined) {
        await ctx.runMutation(internal.subscription.createInitialSubscription, {
          userId: args.userId,
        });
      }
    },
  },
});