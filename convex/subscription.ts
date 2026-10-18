import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";

const DEFAULT_GRANT = 50
const DEFAULT_ROLLOVER_LIMIT = 50
const ENTITLED = new Set(['active', 'trialing', 'trailing', 'paid'])

export const hasEntitlement = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return false;

        const now = Date.now();
        for await (const sub of ctx.db
            .query('subscriptions')
            .withIndex('by_userId', (q) => q.eq('userId', userId))) {
            // Normalize status: lowercase and trim whitespace
            const status = String(sub.status || '').toLowerCase().trim();
            // For subscriptions with period end: check if not expired
            // For one-time purchases (no period end): check if status is entitled
            const periodOk = sub.currentPeriodEnd == null || sub.currentPeriodEnd > now
            const entitled = ENTITLED.has(status)
            if (entitled && periodOk) return true;
        }
        return false;
    }
})

export const upsertFromPolar = internalMutation({
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

// One-off cleanup: the webhook used to save each raw Polar payload, customer details included,
// in `metadata`. Run once after deploying: `npx convex run subscription:clearPolarMetadata`.
export const clearPolarMetadata = internalMutation({
    args: {},
    handler: async (ctx) => {
        let cleared = 0
        for await (const sub of ctx.db.query('subscriptions')) {
            if (sub.metadata !== undefined) {
                await ctx.db.patch(sub._id, { metadata: undefined })
                cleared++
            }
        }
        return { cleared }
    }
})

export const grantCredits = internalMutation({
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

        // Normalize status: lowercase and trim whitespace
        const normalizedStatus = String(sub.status || '').toLowerCase().trim();

        if (!ENTITLED.has(normalizedStatus)) {
            return { ok: true, skipped: true, reason: 'not-entitled' }
        }

        const grant = amount ?? sub.creditsGrantPerPeriod ?? DEFAULT_GRANT

        if (grant <= 0) return { ok: true, skipped: true, reason: 'zero-grant' }

        const next = grant

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
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return 0;

        const sub = await ctx.db.query('subscriptions').withIndex('by_userId', (q) => q.eq('userId', userId)).first();
        if (!sub) return 0;
        const normalizedStatus = String(sub.status || '').toLowerCase().trim();
        if (!ENTITLED.has(normalizedStatus)) return 0;
        return sub.creditsBalance ?? 0;
    }
})

export const consumeCredits = mutation({
    args: {
        amount: v.number(),
        reason: v.optional(v.string()),
        idempotencyKey: v.optional(v.string()),
    },
    handler: async (ctx, { amount, reason, idempotencyKey: clientKey }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return { ok: false, reason: 'not-authenticated' }

        // Also rejects NaN and Infinity, which would otherwise corrupt the stored balance
        if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'invalid-amount' }

        // Ledger keys are shared with the webhook's grants, so a caller-chosen key is namespaced
        // to the caller; otherwise it could match (and block) another subscription's grant.
        const idempotencyKey = clientKey ? `consume:${userId}:${clientKey}` : undefined

        if (idempotencyKey) {
            const duplicate = await ctx.db
                .query('credits_ledger')
                .withIndex('by_idempotencyKey', (q) => q.eq('idempotencyKey', idempotencyKey))
                .first();
            
            if (duplicate) return { ok: true, idempotent: true }
        }

        const sub = await ctx.db
            .query('subscriptions')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .first()

        if (!sub) return { ok: false, reason: 'subscription-not-found' }
        
        // Normalize status: lowercase and trim whitespace
        const normalizedStatus = String(sub.status || '').toLowerCase().trim();
        if (!ENTITLED.has(normalizedStatus)) return { ok: false, reason: 'not-entitled' }

        if (sub.creditsBalance < amount) {
            return { ok: false, error: 'insufficient-balance', balance: sub.creditsBalance }
        }

        const next = sub.creditsBalance - amount
        await ctx.db.patch(sub._id, { creditsBalance: next })

        await ctx.db.insert('credits_ledger', {
            userId,
            subscriptionId: sub._id,
            amount: -amount,
            type: 'consume',
            reasons: reason ?? 'ai-generation',
            idempotencyKey,
            meta: { prev: sub.creditsBalance, next },
        })

        return { ok: true, balance: next }
    }
})