import { NextResponse } from "next/server"
// The import path pins Polar's API version
import { createPolar, type models } from "@polar-sh/sdk/2026-10"
import { fetchQuery } from "convex/nextjs"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { api } from "../../../../../convex/_generated/api"

export async function GET() {
    // Take the buyer from the session, never the request: the webhook credits the userId in the checkout metadata
    const token = await convexAuthNextjsToken()
    const user = await fetchQuery(api.user.getCurrentUser, {}, { token })

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // A second checkout would start a second Polar subscription that keeps billing
    if (await fetchQuery(api.subscription.hasEntitlement, {}, { token })) {
        return NextResponse.json({ error: 'Already subscribed' }, { status: 409 })
    }

    const polar = createPolar({
        environment: process.env.POLAR_ENV === 'sandbox' ? 'sandbox' : 'production',
        accessToken: process.env.POLAR_ACCESS_TOKEN!,
        // Wait up to 30 seconds, not the SDK's default of 5, so a slow reply from Polar still opens checkout
        timeout: 30,
    })

    const checkoutData: models.CheckoutCreate = {
        // POLAR_PLAN holds the product ids, comma-separated (monthly first, then yearly). Polar's
        // checkout lets the buyer pick one, with the first selected.
        products: process.env.POLAR_PLAN!.split(',').map((id) => id.trim()).filter(Boolean),
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
        metadata: {
            userId: user._id
        }
    }

    // Add customer email if available for better tracking
    if (user.email) {
        checkoutData.customer_email = user.email
    }

    const session = await polar.checkouts.create(checkoutData);

    return NextResponse.json({ url: session.url })
}
