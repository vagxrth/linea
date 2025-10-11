import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_GRANT = 10
const DEFAULT_ROLLOVER_LIMIT = 100
const ENTITLED = new Set(['active', 'trailing'])

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

export const grantCredits = mutation({
    args: {
        subscriptionId: v.id('subscriptions'),
        idempotencyKey: v.string(),
        amount: v.optional(v.number()),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, { subscriptionId, idempotencyKey, amount, reason }) => {
        const duplicate = await ctx.db
            .query('credits_ledger')
            .withIndex('by_idempotencyKey', (q) => q.eq('idempotencyKey', idempotencyKey))
            .first();

        if (duplicate) return { ok: true, skipped: true, reason: 'duplicate-key' }

        const sub = await ctx.db.get(subscriptionId);
        if (!sub) return { ok: false, reason: 'subscription-not-found' }

        if (sub.lastGrantCursor === idempotencyKey) {
            return { ok: true, skipped: true, reason: 'cursor-match' }
        }

        if (!ENTITLED.has(sub.status)) {
            return { ok: true, skipped: true, reason: 'not-entitled' }
        }

        const grant = amount ?? sub.creditsGrantPerPeriod ?? DEFAULT_GRANT

        if (grant <= 0) return { ok: true, skipped: true, reason: 'zero-grant' }

        const next = Math.min(sub.creditsBalance + grant, sub.creditsRolloverLimit ?? DEFAULT_ROLLOVER_LIMIT)

        await ctx.db.patch(subscriptionId, {
            creditsBalance: next,
            lastGrantCursor: idempotencyKey,
        })

        await ctx.db.insert('credits_ledger', {
            userId: sub.userId,
            subscriptionId,
            amount: grant,
            type: 'grant',
            reasons: reason ?? 'period-grant',
            idempotencyKey,
            meta: { prev: sub.creditsBalance, next },
        })

        return { ok: true, granted: grant, balance: next }
    }
})

export const getCreditsBalance = query({
    args: { userId: v.id('users') },
    handler: async (ctx, { userId }) => {
        const sub = await ctx.db.query('subscriptions').withIndex('by_userId', (q) => q.eq('userId', userId)).first();
        return sub?.creditsBalance ?? 0;
    }
})