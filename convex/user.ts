import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        return await ctx.db.get(userId);
    }
})

// Finds the user a Polar webhook event belongs to: the userId the checkout route put in the
// metadata if it names an existing user, otherwise the user with the customer's email.
export const resolveUserId = internalQuery({
    args: { userId: v.optional(v.string()), email: v.optional(v.string()) },
    handler: async (ctx, { userId, email }) => {
        const id = userId ? ctx.db.normalizeId('users', userId) : null;
        if (id && (await ctx.db.get(id))) return id;

        if (!email) return null;
        const user = await ctx.db.query('users').withIndex('email', (q) => q.eq('email', email)).first();
        return user?._id ?? null;
    }
})
