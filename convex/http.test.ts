// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { webhooks } from "@polar-sh/sdk/2026-10"
import { convexTest, type TestConvex } from "convex-test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

// Every Convex module except the tests, which Convex skips too (it skips files with more than one dot)
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"])

// Made-up secrets in Polar's format (whsec_ then base64), built at run time so secret scanners don't flag them
const SECRET = `whsec_${btoa("linea-webhook-test-secret")}`
const OTHER_SECRET = `whsec_${btoa("someone-else")}`
const MINUTE = 60 * 1000
const PERIOD_END = "2030-01-01T00:00:00.000Z"
const NEXT_PERIOD_END = "2030-02-01T00:00:00.000Z"

type Test = TestConvex<typeof schema>

interface Delivery {
    body: string
    headers: Record<string, string>
}

// Signs an event the way Polar does for webhook secrets created before 8 September 2026: an
// HMAC-SHA256 of "<webhook-id>.<webhook-timestamp>.<body>" keyed with the secret's UTF-8 bytes
const signedDelivery = async (event: object, options: { secret?: string; timestamp?: number } = {}): Promise<Delivery> => {
    const body = JSON.stringify(event)
    const id = `msg_${crypto.randomUUID()}`
    const timestamp = String(Math.floor((options.timestamp ?? Date.now()) / 1000))

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(options.secret ?? SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    )
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${id}.${timestamp}.${body}`)))

    return {
        body,
        headers: {
            "webhook-id": id,
            "webhook-timestamp": timestamp,
            "webhook-signature": `v1,${btoa(String.fromCharCode(...signature))}`,
        },
    }
}

const withHeader = (delivery: Delivery, name: string, value: string | null): Delivery => {
    const headers = { ...delivery.headers }
    if (value === null) delete headers[name]
    else headers[name] = value
    return { ...delivery, headers }
}

// Polar's own check from the SDK, so the tests can't pass with a signature Polar wouldn't send
const polarAccepts = async ({ body, headers }: Delivery) => {
    try {
        await webhooks.validateEvent(body, headers, SECRET)
        return true
    } catch (error) {
        if (error instanceof webhooks.PolarWebhookVerificationError) return false
        throw error
    }
}

const post = (t: Test, { body, headers }: Delivery) =>
    t.fetch("/polar/webhook", { method: "POST", headers: { "content-type": "application/json", ...headers }, body })

const subscriptionEvent = (type: string, userId: Id<"users">, data: Record<string, unknown> = {}) => ({
    type,
    timestamp: new Date().toISOString(),
    data: {
        id: "sub_1",
        status: "active",
        current_period_end: PERIOD_END,
        customer_id: "cus_1",
        customer: { id: "cus_1", email: "buyer@example.com" },
        product_id: "prod_1",
        product: { id: "prod_1", name: "Linea Pro" },
        prices: [{ id: "price_1" }],
        metadata: { userId },
        ...data,
    },
})

const addUser = (t: Test) => t.run((ctx) => ctx.db.insert("users", { email: "buyer@example.com" }))

const subscriptionsOf = (t: Test) => t.run((ctx) => ctx.db.query("subscriptions").collect())

const ledgerOf = (t: Test) => t.run((ctx) => ctx.db.query("credits_ledger").collect())

describe("POST /polar/webhook", () => {
    beforeEach(() => {
        vi.stubEnv("POLAR_WEBHOOK_SECRET", SECRET)
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it("saves the subscription from a signed event and grants the period's credits", async () => {
        const t = convexTest(schema, modules)
        const userId = await addUser(t)
        const delivery = await signedDelivery(subscriptionEvent("subscription.created", userId))
        expect(await polarAccepts(delivery)).toBe(true)

        const response = await post(t, delivery)

        expect(response.status).toBe(200)
        const subscriptions = await subscriptionsOf(t)
        expect(subscriptions).toHaveLength(1)
        expect(subscriptions[0]).toMatchObject({
            userId,
            polarSubscriptionId: "sub_1",
            polarCustomerId: "cus_1",
            status: "active",
            currentPeriodEnd: Date.parse(PERIOD_END),
            creditsBalance: 50,
        })
        const ledger = await ledgerOf(t)
        expect(ledger).toHaveLength(1)
        expect(ledger[0]).toMatchObject({ amount: 50, type: "grant", idempotencyKey: `sub_1:${Date.parse(PERIOD_END)}` })
    })

    it("grants a period's credits once when Polar delivers the event again", async () => {
        const t = convexTest(schema, modules)
        const userId = await addUser(t)
        const delivery = await signedDelivery(subscriptionEvent("subscription.created", userId))

        await post(t, delivery)
        const repeat = await post(t, delivery)

        expect(repeat.status).toBe(200)
        expect(await ledgerOf(t)).toHaveLength(1)
    })

    it("refills the credits when a renewal moves the period on", async () => {
        const t = convexTest(schema, modules)
        const userId = await addUser(t)
        await post(t, await signedDelivery(subscriptionEvent("subscription.created", userId)))
        const [subscription] = await subscriptionsOf(t)
        await t.run((ctx) => ctx.db.patch(subscription._id, { creditsBalance: 12 }))

        const renewal = await signedDelivery(
            subscriptionEvent("subscription.updated", userId, { current_period_end: NEXT_PERIOD_END }),
        )
        const response = await post(t, renewal)

        expect(response.status).toBe(200)
        expect((await subscriptionsOf(t))[0]).toMatchObject({
            currentPeriodEnd: Date.parse(NEXT_PERIOD_END),
            creditsBalance: 50,
        })
        expect(await ledgerOf(t)).toHaveLength(2)
    })

    it("saves a cancellation without granting credits", async () => {
        const t = convexTest(schema, modules)
        const userId = await addUser(t)
        await post(t, await signedDelivery(subscriptionEvent("subscription.created", userId)))

        const revoked = await signedDelivery(subscriptionEvent("subscription.revoked", userId, { status: "canceled" }))
        const response = await post(t, revoked)

        expect(response.status).toBe(200)
        expect((await subscriptionsOf(t))[0]).toMatchObject({ status: "canceled" })
        expect(await ledgerOf(t)).toHaveLength(1)
    })

    it.each<[string, (event: object) => Promise<Delivery>]>([
        ["the body was changed after signing", async (event) => {
            const delivery = await signedDelivery(event)
            return { ...delivery, body: delivery.body.replace("sub_1", "sub_2") }
        }],
        ["it was signed with another secret", (event) => signedDelivery(event, { secret: OTHER_SECRET })],
        ["its timestamp is more than 5 minutes old", (event) => signedDelivery(event, { timestamp: Date.now() - 6 * MINUTE })],
        ["its timestamp is more than 5 minutes ahead", (event) => signedDelivery(event, { timestamp: Date.now() + 6 * MINUTE })],
        ["it has no signature", async (event) => withHeader(await signedDelivery(event), "webhook-signature", null)],
        ["its signature isn't base64", async (event) => withHeader(await signedDelivery(event), "webhook-signature", "v1,not-base64!")],
        ["its signature has another version", async (event) => {
            const delivery = await signedDelivery(event)
            return withHeader(delivery, "webhook-signature", delivery.headers["webhook-signature"].replace("v1,", "v2,"))
        }],
    ])("rejects an event when %s, and changes nothing", async (_, deliver) => {
        const t = convexTest(schema, modules)
        const userId = await addUser(t)
        const delivery = await deliver(subscriptionEvent("subscription.created", userId))
        expect(await polarAccepts(delivery)).toBe(false)

        const response = await post(t, delivery)

        expect(response.status).toBe(403)
        expect(await subscriptionsOf(t)).toHaveLength(0)
        expect(await ledgerOf(t)).toHaveLength(0)
    })

    it("acknowledges a signed event it doesn't handle, and changes nothing", async () => {
        const t = convexTest(schema, modules)
        const userId = await addUser(t)
        const delivery = await signedDelivery({
            type: "checkout.updated",
            timestamp: new Date().toISOString(),
            data: { id: "chk_1", status: "succeeded", metadata: { userId } },
        })

        const response = await post(t, delivery)

        expect(response.status).toBe(200)
        expect(await subscriptionsOf(t)).toHaveLength(0)
    })

    it("fails without a webhook secret on the deployment", async () => {
        vi.stubEnv("POLAR_WEBHOOK_SECRET", undefined)
        const t = convexTest(schema, modules)
        const userId = await addUser(t)

        const response = await post(t, await signedDelivery(subscriptionEvent("subscription.created", userId)))

        expect(response.status).toBe(500)
        expect(await subscriptionsOf(t)).toHaveLength(0)
    })
})
