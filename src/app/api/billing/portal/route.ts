import { NextResponse } from "next/server"
import { Polar } from "@polar-sh/sdk"
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

    const polar = new Polar({
        server: process.env.POLAR_ENV === 'sandbox' ? 'sandbox' : 'production',
        accessToken: process.env.POLAR_ACCESS_TOKEN!,
    })

    try {
        const session = await polar.customerSessions.create({
            customerId,
            returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        })
        return NextResponse.json({ url: session.customerPortalUrl })
    } catch (error) {
        // Creating a session needs the customer_sessions:write scope on the Polar access token
        console.error('Failed to create Polar customer session:', error)
        return NextResponse.json({ error: 'Could not open the billing portal' }, { status: 502 })
    }
}
