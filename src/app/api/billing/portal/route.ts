import { NextResponse } from "next/server"
// The import path pins Polar's API version
import { createPolar } from "@polar-sh/sdk/2026-10"
import { fetchQuery } from "convex/nextjs"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { api } from "../../../../../convex/_generated/api"

// Opens Polar's customer portal, where subscribers can cancel, change their card and see invoices
export async function GET() {
    const token = await convexAuthNextjsToken()
    const user = await fetchQuery(api.user.getCurrentUser, {}, { token })

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const customerId = await fetchQuery(api.subscription.getPolarCustomerId, {}, { token })
    if (!customerId) {
        return NextResponse.json({ error: 'No subscription to manage' }, { status: 404 })
    }

    const polar = createPolar({
        environment: process.env.POLAR_ENV === 'sandbox' ? 'sandbox' : 'production',
        accessToken: process.env.POLAR_ACCESS_TOKEN!,
        // Wait up to 30 seconds, not the SDK's default of 5, so a slow reply from Polar still opens the portal
        timeout: 30,
    })

    try {
        const session = await polar.customerSessions.create({
            customer_id: customerId,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        })
        return NextResponse.json({ url: session.customer_portal_url })
    } catch (error) {
        // Creating a session needs the customer_sessions:write scope on the Polar access token
        console.error('Failed to create Polar customer session:', error)
        return NextResponse.json({ error: 'Could not open the billing portal' }, { status: 502 })
    }
}
