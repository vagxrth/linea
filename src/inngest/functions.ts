import { fetchMutation, fetchQuery } from "convex/nextjs";
import { inngest } from "./client";
import { api } from "../../convex/_generated/api";
import { extractOrder, extractSubscription, isPolarWebhookEvent, PolarOrder, PolarSubscription, ReceivedEvent } from "@/types/polar";
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

        const subscription: PolarSubscription | null = extractSubscription(data)
        const order: PolarOrder | null = extractOrder(data)

        if (!subscription && !order) return

        const userId: Id<'users'> | null = await step.run('resolve-user', async () => {
            const metaUserId = (subscription?.metadata?.userId as string | undefined) ?? (order?.metadata?.userId as string | undefined)

            if (metaUserId) {
                return metaUserId as Id<'users'>
            }

            const email = subscription?.customer?.email ?? order?.customer?.email ?? null

            if (email) {
                try {
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

        const polarSubscriptionId = subscription?.id ?? order?.subscription_id ?? ''
        if (!polarSubscriptionId) return
    }
)