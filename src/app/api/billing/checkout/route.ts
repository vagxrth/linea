import { NextResponse } from "next/server"
import { Polar } from "@polar-sh/sdk"
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

    const polar = new Polar({
        server: process.env.POLAR_ENV === 'sandbox' ? 'sandbox' : 'production',
        accessToken: process.env.POLAR_ACCESS_TOKEN!,
    })

    const checkoutData: {
        products: string[];
        successUrl: string;
        metadata: { userId: string };
        customerEmail?: string;
    } = {
        products: [process.env.POLAR_PLAN!],
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
        metadata: {
            userId: user._id
        }
    }

    // Add customer email if available for better tracking
    if (user.email) {
        checkoutData.customerEmail = user.email
    }

    const session = await polar.checkouts.create(checkoutData);

    return NextResponse.json({ url: session.url })
}
