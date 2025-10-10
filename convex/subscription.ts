import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_GRANT = 10
const DEFAULT_ROLLOVER_LIMIT = 100

export const hasEntitlement = query({
    args: { userId: v.id('users') },
    handler: async (ctx, { userId }) => {
        const now = Date.now();
        for await (const sub of ctx.db
            .query('subscriptions')
            .withIndex('by_userId', (q) => q.eq('userId', userId))) {
            const status = String(sub.status || '').toLowerCase();
            const periodOk = sub.currentPeriodEnd == null || sub.currentPeriodEnd > now
            if (status === 'active' && periodOk) return true;
        }
        return false;
    }
})

export const getPolarSubscriptionId = query({
    args: { polarSubscriptionId: v.string() },
    handler: async (ctx, { polarSubscriptionId }) => {
        return await ctx.db
            .query('subscriptions')
            .withIndex('by_polarSubscriptionId', (q) => q.eq('polarSubscriptionId', polarSubscriptionId))
            .first();
    }
})

export const getSubscriptionByUser = query({
    args: { userId: v.id('users') },
    handler: async (ctx, { userId }) => {
        return await ctx.db
            .query('subscriptions')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .first();
    }
})

export const getAllForUser = query({
    args: { userId: v.id('users') },
    handler: async (ctx, { userId }) => {
        return await ctx.db
            .query('subscriptions')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .collect();
    }
})

export const upsertFromPolar = mutation({
    args: {
        userId: v.id('users'),
        polarCustomerId: v.string(),
        polarSubscriptionId: v.string(),
        productId: v.optional(v.string()),
        priceId: v.optional(v.string()),
        planCode: v.optional(v.string()),
        status: v.string(),
        currentPeriodEnd: v.optional(v.number()),
        trialEndsAt: v.optional(v.number()),
        cancelAt: v.optional(v.number()),
        cancelledAt: v.optional(v.number()),
        seats: v.optional(v.number()),
        metadata: v.optional(v.any()),
        creditsGrantPerPeriod: v.optional(v.number()),
        creditsRolloverLimit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const existingByPolar = await ctx.db
            .query('subscriptions')
            .withIndex('by_polarSubscriptionId', (q) => q.eq('polarSubscriptionId', args.polarSubscriptionId))
            .first();

        const existingByUser = await ctx.db
            .query('subscriptions')
            .withIndex('by_userId', (q) => q.eq('userId', args.userId))
            .first();

        const base = {
            userId: args.userId,
            polarCustomerId: args.polarCustomerId,
            polarSubscriptionId: args.polarSubscriptionId,
            productId: args.productId,
            priceId: args.priceId,
            planCode: args.planCode,
            status: args.status,
            currentPeriodEnd: args.currentPeriodEnd,
            trialEndsAt: args.trialEndsAt,
            cancelAt: args.cancelAt,
            cancelledAt: args.cancelledAt,
            seats: args.seats,
            metadata: args.metadata,
            creditsGrantPerPeriod:
                args.creditsGrantPerPeriod ??
                existingByPolar?.creditsGrantPerPeriod ??
                existingByUser?.creditsGrantPerPeriod ??
                DEFAULT_GRANT,
            creditsRolloverLimit:
                args.creditsRolloverLimit ??
                existingByPolar?.creditsRolloverLimit ??
                existingByUser?.creditsRolloverLimit ??
                DEFAULT_ROLLOVER_LIMIT,
        }

        if (existingByPolar) {
            if (existingByPolar.userId === args.userId) {
                await ctx.db.patch(existingByPolar._id, base)
                return existingByPolar._id
            } else {
                const userExistingSubscription = await ctx.db
                    .query('subscriptions')
                    .withIndex('by_userId', (q) => q.eq('userId', args.userId))
                    .first();

                if (userExistingSubscription) {
                    const preservedData = {
                        creditsBalance: userExistingSubscription.creditsBalance,
                        lastGrantCursor: userExistingSubscription.lastGrantCursor,
                    }

                    await ctx.db.patch(userExistingSubscription._id, {
                        ...base,
                        ...preservedData,
                    })
                    return userExistingSubscription._id
                } else {
                    const newId = await ctx.db.insert('subscriptions', {
                        ...base,
                        creditsBalance: 0,
                        lastGrantCursor: undefined
                    })
                    return newId
                }
            }
        }

        if (existingByUser) {
            const preservedData = {
                creditsBalance: existingByUser.creditsBalance,
                lastGrantCursor: existingByUser.lastGrantCursor,
            }
            await ctx.db.patch(existingByUser._id, {
                ...base,
                ...preservedData,
            })
            return existingByUser._id
        }

        const newId = await ctx.db.insert('subscriptions', {
            ...base,
            creditsBalance: 0,
            lastGrantCursor: undefined
        })
        return newId
    }
})