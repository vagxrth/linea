// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test"
import { afterEach, describe, expect, it, vi } from "vitest"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"
import { monthsSince } from "./subscription"

// Every Convex module except the tests, which Convex skips too (it skips files with more than one dot)
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"])

const DAY = 24 * 60 * 60 * 1000

type Test = TestConvex<typeof schema>

interface SubscriptionOptions {
    status?: string
    creditsBalance?: number
    creditsGrantPerPeriod?: number
    recurringInterval?: string
    currentPeriodStart?: number
    currentPeriodEnd?: number
}

// Adds a user with a subscription, and returns a client signed in as them
const addSubscriber = async (t: Test, options: SubscriptionOptions = {}) => {
    const { userId, subscriptionId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", { email: "test@example.com" })
        const subscriptionId = await ctx.db.insert("subscriptions", {
            userId,
            polarCustomerId: `cus_${userId}`,
            polarSubscriptionId: `sub_${userId}`,
            status: options.status ?? "active",
            recurringInterval: options.recurringInterval,
            currentPeriodStart: options.currentPeriodStart,
            currentPeriodEnd: options.currentPeriodEnd ?? Date.now() + 30 * DAY,
            creditsBalance: options.creditsBalance ?? 10,
            creditsGrantPerPeriod: options.creditsGrantPerPeriod ?? 10,
            creditsRolloverLimit: 0,
        })
        return { userId, subscriptionId }
    })
    // Convex Auth puts "userId|sessionId" in the token's subject
    const asUser = t.withIdentity({ subject: `${userId}|test-session` })
    return { asUser, userId, subscriptionId }
}

const balanceOf = (t: Test, subscriptionId: Id<"subscriptions">) =>
    t.run(async (ctx) => (await ctx.db.get(subscriptionId))?.creditsBalance)

const ledgerOf = (t: Test, subscriptionId: Id<"subscriptions">) =>
    t.run((ctx) =>
        ctx.db
            .query("credits_ledger")
            .withIndex("by_subscriptionId", (q) => q.eq("subscriptionId", subscriptionId))
            .collect()
    )

describe("consumeCredits", () => {
    it("takes the amount from the balance and records it in the ledger", async () => {
        const t = convexTest(schema, modules)
        const { asUser, subscriptionId } = await addSubscriber(t, { creditsBalance: 10 })

        const result = await asUser.mutation(api.subscription.consumeCredits, { amount: 4 })

        expect(result).toEqual({ ok: true, balance: 6 })
        expect(await balanceOf(t, subscriptionId)).toBe(6)
        const ledger = await ledgerOf(t, subscriptionId)
        expect(ledger).toHaveLength(1)
        expect(ledger[0]).toMatchObject({ amount: -4, type: "consume", meta: { prev: 10, next: 6 } })
    })

    it("refuses more than the balance and leaves it unchanged", async () => {
        const t = convexTest(schema, modules)
        const { asUser, subscriptionId } = await addSubscriber(t, { creditsBalance: 3 })

        const result = await asUser.mutation(api.subscription.consumeCredits, { amount: 4 })

        expect(result).toMatchObject({ ok: false, error: "insufficient-balance", balance: 3 })
        expect(await balanceOf(t, subscriptionId)).toBe(3)
        expect(await ledgerOf(t, subscriptionId)).toHaveLength(0)
    })

    it.each([0, -1, 1.5, NaN, Infinity])("refuses an amount of %s", async (amount) => {
        const t = convexTest(schema, modules)
        const { asUser, subscriptionId } = await addSubscriber(t, { creditsBalance: 10 })

        const result = await asUser.mutation(api.subscription.consumeCredits, { amount })

        expect(result).toEqual({ ok: false, reason: "invalid-amount" })
        expect(await balanceOf(t, subscriptionId)).toBe(10)
    })

    it("refuses signed-out callers", async () => {
        const t = convexTest(schema, modules)
        await addSubscriber(t)

        const result = await t.mutation(api.subscription.consumeCredits, { amount: 1 })

        expect(result).toEqual({ ok: false, reason: "not-authenticated" })
    })

    it("refuses users whose subscription isn't active", async () => {
        const t = convexTest(schema, modules)
        const { asUser, subscriptionId } = await addSubscriber(t, { status: "canceled", creditsBalance: 10 })

        const result = await asUser.mutation(api.subscription.consumeCredits, { amount: 1 })

        expect(result).toEqual({ ok: false, reason: "not-entitled" })
        expect(await balanceOf(t, subscriptionId)).toBe(10)
    })

    it("charges a repeated idempotency key once", async () => {
        const t = convexTest(schema, modules)
        const { asUser, subscriptionId } = await addSubscriber(t, { creditsBalance: 10 })

        await asUser.mutation(api.subscription.consumeCredits, { amount: 3, idempotencyKey: "generation-1" })
        const repeat = await asUser.mutation(api.subscription.consumeCredits, { amount: 3, idempotencyKey: "generation-1" })

        expect(repeat).toEqual({ ok: true, idempotent: true })
        expect(await balanceOf(t, subscriptionId)).toBe(7)
        expect(await ledgerOf(t, subscriptionId)).toHaveLength(1)
    })

    it("keeps idempotency keys separate per user", async () => {
        const t = convexTest(schema, modules)
        const first = await addSubscriber(t, { creditsBalance: 10 })
        const second = await addSubscriber(t, { creditsBalance: 10 })

        await first.asUser.mutation(api.subscription.consumeCredits, { amount: 2, idempotencyKey: "same-key" })
        const result = await second.asUser.mutation(api.subscription.consumeCredits, { amount: 2, idempotencyKey: "same-key" })

        expect(result).toEqual({ ok: true, balance: 8 })
        expect(await balanceOf(t, first.subscriptionId)).toBe(8)
    })

    it("can't use a key to block a later grant with the same key", async () => {
        const t = convexTest(schema, modules)
        const { asUser, subscriptionId } = await addSubscriber(t, { creditsBalance: 5, creditsGrantPerPeriod: 10 })

        await asUser.mutation(api.subscription.consumeCredits, { amount: 1, idempotencyKey: "order_123" })
        const grant = await t.mutation(internal.subscription.grantCredits, { subscriptionId, idempotencyKey: "order_123" })

        expect(grant).toEqual({ ok: true, granted: 10, balance: 10 })
    })
})

describe("grantCredits", () => {
    it("sets the balance to the plan's grant and records it in the ledger", async () => {
        const t = convexTest(schema, modules)
        const { subscriptionId } = await addSubscriber(t, { creditsBalance: 3, creditsGrantPerPeriod: 10 })

        const result = await t.mutation(internal.subscription.grantCredits, { subscriptionId, idempotencyKey: "period-1" })

        expect(result).toEqual({ ok: true, granted: 10, balance: 10 })
        const ledger = await ledgerOf(t, subscriptionId)
        expect(ledger).toHaveLength(1)
        expect(ledger[0]).toMatchObject({ amount: 10, type: "grant", idempotencyKey: "period-1", meta: { prev: 3, next: 10 } })
    })

    it("doesn't roll unused credits over", async () => {
        const t = convexTest(schema, modules)
        const { subscriptionId } = await addSubscriber(t, { creditsBalance: 7, creditsGrantPerPeriod: 10 })

        await t.mutation(internal.subscription.grantCredits, { subscriptionId, idempotencyKey: "period-2" })

        expect(await balanceOf(t, subscriptionId)).toBe(10)
    })

    it("applies each idempotency key once", async () => {
        const t = convexTest(schema, modules)
        const { asUser, subscriptionId } = await addSubscriber(t, { creditsBalance: 0, creditsGrantPerPeriod: 10 })

        await t.mutation(internal.subscription.grantCredits, { subscriptionId, idempotencyKey: "period-1" })
        await asUser.mutation(api.subscription.consumeCredits, { amount: 4 })
        const repeat = await t.mutation(internal.subscription.grantCredits, { subscriptionId, idempotencyKey: "period-1" })

        expect(repeat).toMatchObject({ ok: true, skipped: true, reason: "duplicate-key" })
        expect(await balanceOf(t, subscriptionId)).toBe(6)
    })

    it("skips subscriptions that aren't active", async () => {
        const t = convexTest(schema, modules)
        const { subscriptionId } = await addSubscriber(t, { status: "canceled", creditsBalance: 0 })

        const result = await t.mutation(internal.subscription.grantCredits, { subscriptionId, idempotencyKey: "period-1" })

        expect(result).toMatchObject({ ok: true, skipped: true, reason: "not-entitled" })
        expect(await balanceOf(t, subscriptionId)).toBe(0)
    })

    it("uses the amount given instead of the plan's grant", async () => {
        const t = convexTest(schema, modules)
        const { subscriptionId } = await addSubscriber(t, { creditsBalance: 0, creditsGrantPerPeriod: 10 })

        await t.mutation(internal.subscription.grantCredits, { subscriptionId, idempotencyKey: "bonus-1", amount: 25 })

        expect(await balanceOf(t, subscriptionId)).toBe(25)
    })
})

describe("getCreditsBalance", () => {
    it("returns the balance of an active subscription", async () => {
        const t = convexTest(schema, modules)
        const { asUser } = await addSubscriber(t, { creditsBalance: 8 })

        expect(await asUser.query(api.subscription.getCreditsBalance, {})).toBe(8)
    })

    it("returns 0 for a subscription that isn't active, and for signed-out callers", async () => {
        const t = convexTest(schema, modules)
        const { asUser } = await addSubscriber(t, { status: "canceled", creditsBalance: 8 })

        expect(await asUser.query(api.subscription.getCreditsBalance, {})).toBe(0)
        expect(await t.query(api.subscription.getCreditsBalance, {})).toBe(0)
    })
})

describe("hasEntitlement", () => {
    it("is true for an active subscription whose period hasn't ended", async () => {
        const t = convexTest(schema, modules)
        const { asUser } = await addSubscriber(t, { status: " Active " })

        expect(await asUser.query(api.subscription.hasEntitlement, {})).toBe(true)
    })

    it("is false once the period has ended, for canceled subscriptions, and when signed out", async () => {
        const t = convexTest(schema, modules)
        const ended = await addSubscriber(t, { currentPeriodEnd: Date.now() - DAY })
        const canceled = await addSubscriber(t, { status: "canceled" })

        expect(await ended.asUser.query(api.subscription.hasEntitlement, {})).toBe(false)
        expect(await canceled.asUser.query(api.subscription.hasEntitlement, {})).toBe(false)
        expect(await t.query(api.subscription.hasEntitlement, {})).toBe(false)
    })
})

describe("monthsSince", () => {
    const start = Date.UTC(2027, 0, 15, 10)

    it("counts whole months from the start's day and time", () => {
        expect(monthsSince(start, Date.UTC(2027, 0, 20))).toBe(0)
        expect(monthsSince(start, Date.UTC(2027, 1, 15, 9, 59))).toBe(0)
        expect(monthsSince(start, Date.UTC(2027, 1, 15, 10))).toBe(1)
        expect(monthsSince(start, Date.UTC(2027, 11, 15, 10))).toBe(11)
        expect(monthsSince(start, Date.UTC(2028, 0, 15, 10))).toBe(12)
    })

    it("moves an anniversary past a shorter month's end to its last day", () => {
        const endOfMonth = Date.UTC(2027, 0, 31)
        expect(monthsSince(endOfMonth, Date.UTC(2027, 1, 27))).toBe(0)
        expect(monthsSince(endOfMonth, Date.UTC(2027, 1, 28))).toBe(1)
        expect(monthsSince(endOfMonth, Date.UTC(2027, 2, 30))).toBe(1)
        expect(monthsSince(endOfMonth, Date.UTC(2027, 2, 31))).toBe(2)
        expect(monthsSince(Date.UTC(2026, 10, 30), Date.UTC(2027, 1, 28))).toBe(3)
    })
})

describe("refillYearlyCredits", () => {
    const periodStart = Date.UTC(2027, 0, 15, 10)
    const periodEnd = Date.UTC(2028, 0, 15, 10)
    const yearly = { recurringInterval: "year", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd }

    afterEach(() => {
        vi.useRealTimers()
    })

    const refillAt = async (t: Test, time: number) => {
        vi.useFakeTimers()
        vi.setSystemTime(time)
        await t.mutation(internal.subscription.refillYearlyCredits, {})
    }

    it("refills a yearly plan on each monthly anniversary, once a month", async () => {
        const t = convexTest(schema, modules)
        const { userId, subscriptionId } = await addSubscriber(t, { ...yearly, creditsBalance: 12, creditsGrantPerPeriod: 100 })

        await refillAt(t, Date.UTC(2027, 1, 15, 11))
        expect(await balanceOf(t, subscriptionId)).toBe(100)
        expect(await ledgerOf(t, subscriptionId)).toMatchObject([
            { amount: 100, type: "grant", reasons: "monthly-refill", idempotencyKey: `sub_${userId}:${periodEnd}:month-1` },
        ])

        // Again in the same month: nothing new
        await t.run((ctx) => ctx.db.patch(subscriptionId, { creditsBalance: 40 }))
        await refillAt(t, Date.UTC(2027, 1, 20))
        expect(await balanceOf(t, subscriptionId)).toBe(40)
        expect(await ledgerOf(t, subscriptionId)).toHaveLength(1)

        // The next month refills again
        await refillAt(t, Date.UTC(2027, 2, 15, 10))
        expect(await balanceOf(t, subscriptionId)).toBe(100)
        expect(await ledgerOf(t, subscriptionId)).toHaveLength(2)
    })

    it("leaves the first month, monthly plans, inactive and ended subscriptions alone", async () => {
        const t = convexTest(schema, modules)
        const firstMonth = await addSubscriber(t, { ...yearly, creditsBalance: 5 })
        const monthly = await addSubscriber(t, { recurringInterval: "month", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, creditsBalance: 5 })
        const canceled = await addSubscriber(t, { ...yearly, status: "canceled", creditsBalance: 5 })
        const ended = await addSubscriber(t, { ...yearly, currentPeriodEnd: Date.UTC(2027, 0, 30), creditsBalance: 5 })

        // Still month 0: the first month's credits came with Polar's event
        await refillAt(t, Date.UTC(2027, 1, 14))
        expect(await balanceOf(t, firstMonth.subscriptionId)).toBe(5)
        expect(await ledgerOf(t, firstMonth.subscriptionId)).toHaveLength(0)

        // Month 1, and past the end of the last subscription's period
        await refillAt(t, Date.UTC(2027, 1, 15, 11))
        expect(await balanceOf(t, firstMonth.subscriptionId)).toBe(10)
        for (const { subscriptionId } of [monthly, canceled, ended]) {
            expect(await balanceOf(t, subscriptionId)).toBe(5)
            expect(await ledgerOf(t, subscriptionId)).toHaveLength(0)
        }
    })
})
