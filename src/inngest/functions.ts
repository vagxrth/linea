import { fetchMutation, fetchQuery } from "convex/nextjs";
import { inngest } from "./client";
import { api } from "../../convex/_generated/api";
import { entitledStatus, extractOrder, extractSubscription, isPolarWebhookEvent, PolarOrder, PolarSubscription, ReceivedEvent, toMs } from "@/types/polar";
import { Id } from "../../convex/_generated/dataModel";

export const autosaveProjectWorkflow = inngest.createFunction(
    { id: 'autosave-project-workflow' },
    { event: 'project/autosave.requested' },
    async ({ event }) => {
        const { projectId, shapesData, viewportData } = event.data
        try {
            await fetchMutation(api.projects.updateProjectSketches, {
                projectId,
                sketchesData: shapesData,
                viewportData,
            })
            return { success: true }
        } catch (error) {
            throw error
        }
    }
)

const grantKey = (subId: string, periodEndMs?: number, eventId?: string | number): string => periodEndMs != null
    ? `${subId}:${periodEndMs}`
    : eventId != null ? `${subId}:evt:${eventId}` : `${subId}:first`


export const handlePolarEvent = inngest.createFunction(
    { id: 'polar-webhook-handler' },
    { event: 'polar/webhook.received' },
    async ({ event, step }) => {
        if (!isPolarWebhookEvent(event.data)) {
            return
        }

        const incoming = event.data as ReceivedEvent
        const type = incoming.type
        const data = incoming.data

        console.log('🎯 Webhook received - Type:', type)

        const subscription: PolarSubscription | null = extractSubscription(data)
        const order: PolarOrder | null = extractOrder(data)

        console.log('📦 Extracted - Subscription:', subscription ? '✓' : '✗', 'Order:', order ? '✓' : '✗')

        if (!subscription && !order) {
            console.log('⚠️ No subscription or order data found, exiting')
            return
        }

        const userId: Id<'users'> | null = await step.run('resolve-user', async () => {
            const metaUserId = (subscription?.metadata?.userId as string | undefined) ?? (order?.metadata?.userId as string | undefined)

            if (metaUserId) {
                console.log('Found userId in metadata:', metaUserId)
                return metaUserId as Id<'users'>
            }

            const email = subscription?.customer?.email ?? order?.customer?.email ?? null

            if (email) {
                try {
                    console.log('Looking up user by email:', email)
                    const foundUserId = await fetchQuery(api.user.getUserIdByEmail, { email })
                    return foundUserId
                } catch (error) {
                    console.error('Failed to resolve user', error)
                    return null
                }
            }
            console.log('No email found')
            return null
        })
        console.log('Resolved user', userId)
        if (!userId) return

        // For one-time purchases, use order ID; for subscriptions, use subscription ID
        const polarSubscriptionId = subscription?.id ?? order?.subscription_id ?? order?.id ?? ''
        console.log('Using ID:', polarSubscriptionId, 'from', subscription ? 'subscription' : 'order')
        if (!polarSubscriptionId) return

        const currentPeriodEnd = toMs(subscription?.current_period_end)

        // Detect if this is a one-time purchase (order without subscription)
        const isOneTimePurchase = !subscription && !!order
        
        // For one-time purchases, set status to 'active' to pass entitlement checks
        // For subscriptions, use actual status
        const status = subscription?.status ?? (isOneTimePurchase ? 'active' : 'updated')
        
        console.log('Purchase type:', isOneTimePurchase ? 'one-time' : 'subscription', 'Status:', status)

        const payload = {
            userId,
            polarCustomerId: subscription?.customer?.id ?? subscription?.customer_id ?? order?.customer_id ?? '',
            polarSubscriptionId,
            productId: subscription?.product_id ?? subscription?.product?.id ?? undefined,
            priceId: subscription?.prices?.[0]?.id ?? undefined,
            planCode: subscription?.plan_code ?? subscription?.product?.name ?? 'credit-purchase',
            status,
            currentPeriodEnd,
            trialEndsAt: toMs(subscription?.trial_ends_at),
            cancelAt: toMs(subscription?.cancel_at),
            cancelledAt: toMs(subscription?.cancelled_at),
            seats: subscription?.seats ?? undefined,
            metadata: data,
            creditsGrantPerPeriod: 10,
            creditsRolloverLimit: 100
        }

        const subscriptionId = await step.run('upsert-subscription', async () => {
            try {
                const existingByPolar = await fetchQuery(api.subscription.getPolarSubscriptionId, {
                    polarSubscriptionId: payload.polarSubscriptionId
                })

                const existingByUser = await fetchQuery(api.subscription.getSubscriptionByUser, { userId: payload.userId })

                if (existingByPolar && existingByUser && existingByPolar._id !== existingByUser._id) {
                    console.log('Subscription already exists for another user')
                }

                const result = await fetchMutation(api.subscription.upsertFromPolar, payload)

                const allUserSubs = await fetchQuery(api.subscription.getAllForUser, { userId: payload.userId })

                if (allUserSubs && allUserSubs.length > 1) {
                    allUserSubs.forEach((sub, index) => {
                        console.error(`${index + 1}. ID: ${sub._id}, Polar Subscription ID: ${sub.polarSubscriptionId}`)
                    })
                }
                return result
            } catch (error) {
                throw error
            }
        })

        const createSubscription = /subscription\.created/i.test(type)
        const renewSubscription = /subscription\.renew|order\.created|order\.updated|invoice\.paid|order\.paid/i.test(type)

        const entitled = entitledStatus(payload.status)

        console.log('Event type:', type)
        console.log('Is create subscription:', createSubscription)
        console.log('Is renew/order:', renewSubscription)
        console.log('Entitled:', entitled, '(status:', payload.status, ')')

        const idempotencyKey = grantKey(polarSubscriptionId, currentPeriodEnd, incoming.id)

        if (entitled && (createSubscription || renewSubscription || true)) {
            console.log('Attempting to grant credits...')
            const grant = await step.run('grant-credits', async () => {
                try {
                    const result = await fetchMutation(api.subscription.grantCredits, {
                        subscriptionId,
                        idempotencyKey,
                        amount: 10,
                        reason: createSubscription ? 'initial-grant' : 'period-grant'
                    })
                    console.log('Grant result:', result)
                    return result
                } catch (error) {
                    console.error('Error granting credits:', error)
                    throw error
                }
            })
            if (grant.ok && !('skipped' in grant && grant.skipped)) {
                console.log('✅ Credits granted successfully!', grant)
                await step.sendEvent('credits-granted', {
                    name: 'billing/credits.granted',
                    id: `credits-granted:${polarSubscriptionId}:${currentPeriodEnd ?? 'first'}`,
                    data: {
                        userId,
                        amount: 'granted' in grant ? (grant.granted ?? 10) : 10,
                        balance: 'balance' in grant ? grant.balance : undefined,
                        periodEnd: currentPeriodEnd
                    }
                })
            } else {
                console.log('⚠️ Credits not granted, reason:', grant)
            }
        } else {
            console.log('❌ Not entitled for credits grant - entitled:', entitled, 'create:', createSubscription, 'renew:', renewSubscription)
        }

        await step.sendEvent('sub-synced', {
            name: 'billing/subscription.synced',
            id: `sub-synced:${polarSubscriptionId}:${currentPeriodEnd ?? 'first'}`,
            data: {
                userId,
                polarSubscriptionId,
                status: payload.status,
                currentPeriodEnd
            }
        })

        if (currentPeriodEnd && currentPeriodEnd > Date.now()) {
            const runAt = new Date(Math.max(Date.now() + 5000, currentPeriodEnd - 3 * 24 * 60 * 60 * 1000))
            await step.sleepUntil('wait-until-expiry', runAt)

            const stillEntitled = await step.run('check-entitlement', async () => {
                try {
                    const result = await fetchQuery(api.subscription.hasEntitlement, {
                        userId
                    })
                    return result
                } catch (error) {
                    throw error
                }
            })

            if (stillEntitled) {
                await step.sendEvent('pre-expiry', {
                    name: 'billing/subscription.pre_expiry',
                    data: {
                        userId,
                        runAt: runAt.toISOString(),
                        periodEnd: currentPeriodEnd
                    }
                })
            }
        }
    }
)