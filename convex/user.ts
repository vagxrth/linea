import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        return await ctx.db.get(userId);
    }
})

export const getCurrentUserById = query({
    args: { userId: v.id('users') },
    handler: async (ctx, { userId }) => {
        return await ctx.db.get(userId);
    }
})

export const getUserIdByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, { email }) => {
        const user = await ctx.db.query('users').withIndex('email', (q) => q.eq('email', email)).first();
        return user?._id ?? null;
    }
})