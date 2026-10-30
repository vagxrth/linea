import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Linea Pro's credits, granted every month whether the plan is billed monthly or yearly
export const CREDITS_PER_MONTH = 100

// Linea Pro's Polar product ids, from POLAR_PLAN: comma-separated, monthly first, the same value as on Vercel
export const productIds = (plan: string | undefined) => (plan ?? '').split(',').map((id) => id.trim()).filter(Boolean)
// Credits every account gets once its email is confirmed, to try Linea. They don't come back once spent.
export const FREE_CREDITS = 10
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
        recurringInterval: v.optional(v.string()),
        currentPeriodStart: v.optional(v.number()),
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
            // An event without the customer keeps the one already saved, which Manage plan needs
            polarCustomerId: args.polarCustomerId || existingByPolar?.polarCustomerId || existingByUser?.polarCustomerId || '',
            polarSubscriptionId: args.polarSubscriptionId,
            productId: args.productId,
            priceId: args.priceId,
            planCode: args.planCode,
            status: args.status,
            recurringInterval: args.recurringInterval,
            currentPeriodStart: args.currentPeriodStart,
            currentPeriodEnd: args.currentPeriodEnd,
            trialEndsAt: args.trialEndsAt,
            cancelAt: args.cancelAt,
            cancelledAt: args.cancelledAt,
            seats: args.seats,
            creditsGrantPerPeriod:
                args.creditsGrantPerPeriod ??
                existingByPolar?.creditsGrantPerPeriod ??
                existingByUser?.creditsGrantPerPeriod ??
                CREDITS_PER_MONTH,
            creditsRolloverLimit:
                args.creditsRolloverLimit ??
                existingByPolar?.creditsRolloverLimit ??
                existingByUser?.creditsRolloverLimit ??
                CREDITS_PER_MONTH,
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

// One-off for going live on Polar production: until then every purchase went through Polar's sandbox
// with test cards. This ends the subscriptions still active from it, and takes back their credits, so
// those accounts can subscribe for real. Subscriptions to the products in POLAR_PLAN, which on the
// deployment lists the production products, are left alone. Run once after setting POLAR_PLAN:
// `npx convex run subscription:endSandboxSubscriptions`.
export const endSandboxSubscriptions = internalMutation({
    args: {},
    handler: async (ctx) => {
        const proProducts = productIds(process.env.POLAR_PLAN)
        if (proProducts.length === 0) throw new Error('Set POLAR_PLAN on the deployment first')

        let ended = 0
        for await (const sub of ctx.db.query('subscriptions')) {
            if (!ENTITLED.has(String(sub.status || '').toLowerCase().trim())) continue
            if (sub.productId && proProducts.includes(sub.productId)) continue

            await ctx.db.patch(sub._id, { status: 'canceled', creditsBalance: 0 })
            await ctx.db.insert('credits_ledger', {
                userId: sub.userId,
                subscriptionId: sub._id,
                amount: -sub.creditsBalance,
                type: 'reset',
                reasons: 'sandbox-ended',
                meta: { prev: sub.creditsBalance, next: 0, status: sub.status },
            })
            ended++
        }
        return { ended }
    }
})

interface Grant {
    subscriptionId: Id<'subscriptions'>
    idempotencyKey: string
    amount?: number
    reason?: string
}

// Sets a subscription's balance to its grant (unused credits don't roll over), once per idempotency key
const grantPeriodCredits = async (ctx: MutationCtx, { subscriptionId, idempotencyKey, amount, reason }: Grant) => {
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

    const grant = amount ?? sub.creditsGrantPerPeriod ?? CREDITS_PER_MONTH

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

export const grantCredits = internalMutation({
    args: {
        subscriptionId: v.id('subscriptions'),
        idempotencyKey: v.string(),
        amount: v.optional(v.number()),
        reason: v.optional(v.string()),
    },
    handler: (ctx, args) => grantPeriodCredits(ctx, args),
})

// Whole months from `start` to `now`: 0 until the first monthly anniversary of `start`, then 1, and
// so on. An anniversary past the end of a shorter month (the 31st in February) falls on its last day.
export const monthsSince = (start: number, now: number) => {
    const from = new Date(start)
    const to = new Date(now)
    let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
    const lastDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate()
    const anniversary = Date.UTC(
        to.getUTCFullYear(),
        to.getUTCMonth(),
        Math.min(from.getUTCDate(), lastDay),
        from.getUTCHours(),
        from.getUTCMinutes(),
        from.getUTCSeconds(),
        from.getUTCMilliseconds(),
    )
    if (now < anniversary) months--
    return months
}

// Polar sends events only when a billing period starts, so a yearly plan's credits would come once a
// year. This refills them on each monthly anniversary of the period start instead; crons.ts runs it
// every hour.
export const refillYearlyCredits = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        let refilled = 0
        for (const status of ENTITLED) {
            for await (const sub of ctx.db.query('subscriptions').withIndex('by_status', (q) => q.eq('status', status))) {
                if (sub.recurringInterval !== 'year' || sub.currentPeriodStart == null || sub.currentPeriodEnd == null) continue
                if (sub.currentPeriodEnd <= now) continue

                // Month 0's credits came with Polar's event, and month 12 is the next period's renewal
                const month = monthsSince(sub.currentPeriodStart, now)
                if (month < 1 || month > 11) continue

                const result = await grantPeriodCredits(ctx, {
                    subscriptionId: sub._id,
                    idempotencyKey: `${sub.polarSubscriptionId}:${sub.currentPeriodEnd}:month-${month}`,
                    reason: 'monthly-refill',
                })
                if ('granted' in result) refilled++
            }
        }
        if (refilled > 0) console.log(`Refilled credits for ${refilled} yearly subscriptions`)
    },
})

// The user's subscription and its credits, which count only while it's active
const paidCredits = async (ctx: QueryCtx, userId: Id<'users'>) => {
    const sub = await ctx.db.query('subscriptions').withIndex('by_userId', (q) => q.eq('userId', userId)).first();
    // Normalize status: lowercase and trim whitespace
    if (!sub || !ENTITLED.has(String(sub.status || '').toLowerCase().trim())) return { sub: null, balance: 0 }
    return { sub, balance: sub.creditsBalance }
}

// The user's free credits. Until they spend one there's no row, and a confirmed email (which
// Google accounts have from the start) is worth FREE_CREDITS.
const freeCredits = async (ctx: QueryCtx, userId: Id<'users'>) => {
    const row = await ctx.db.query('free_credits').withIndex('by_userId', (q) => q.eq('userId', userId)).first();
    if (row) return { row, balance: row.balance }
    const user = await ctx.db.get(userId);
    return { row: null, balance: user?.emailVerificationTime != null ? FREE_CREDITS : 0 }
}

export const getCreditsBalance = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return 0;

        const [paid, free] = await Promise.all([paidCredits(ctx, userId), freeCredits(ctx, userId)])
        return paid.balance + free.balance
    }
})

// The caller's own Polar customer id, used to open Polar's customer portal
export const getPolarCustomerId = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;

        const sub = await ctx.db.query('subscriptions').withIndex('by_userId', (q) => q.eq('userId', userId)).first();
        return sub?.polarCustomerId || null;
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

        const [paid, free] = await Promise.all([paidCredits(ctx, userId), freeCredits(ctx, userId)])
        const balance = paid.balance + free.balance
        if (balance < amount) {
            return { ok: false, error: 'insufficient-balance', balance }
        }

        // The plan's credits go first: they're replaced every month, and free ones never come back
        const fromPaid = Math.min(amount, paid.balance)
        const fromFree = amount - fromPaid
        const entry = { userId, type: 'consume', reasons: reason ?? 'ai-generation', idempotencyKey }

        if (paid.sub && fromPaid > 0) {
            const next = paid.balance - fromPaid
            await ctx.db.patch(paid.sub._id, { creditsBalance: next })
            await ctx.db.insert('credits_ledger', {
                ...entry,
                subscriptionId: paid.sub._id,
                amount: -fromPaid,
                meta: { prev: paid.balance, next },
            })
        }

        if (fromFree > 0) {
            const next = free.balance - fromFree
            if (free.row) await ctx.db.patch(free.row._id, { balance: next })
            else await ctx.db.insert('free_credits', { userId, balance: next })
            await ctx.db.insert('credits_ledger', {
                ...entry,
                amount: -fromFree,
                meta: { prev: free.balance, next },
            })
        }

        return { ok: true, balance: balance - amount }
    }
})