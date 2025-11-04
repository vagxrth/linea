import { NextRequest, NextResponse } from "next/server"
import { Polar } from "@polar-sh/sdk"
import { fetchQuery } from "convex/nextjs"
import { api } from "../../../../../convex/_generated/api"
import { Id } from "../../../../../convex/_generated/dataModel"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
        return NextResponse.json({ error: 'Missing User ID' }, { status: 400 })
    }

    // Get user email for better Polar integration
    let userEmail: string | undefined
    try {
        const user = await fetchQuery(api.user.getCurrentUserById, { userId: userId as Id<'users'> })
        userEmail = user?.email
    } catch (error) {
        console.error('Failed to get user email:', error)
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
            userId
        }
    }

    // Add customer email if available for better tracking
    if (userEmail) {
        checkoutData.customerEmail = userEmail
    }

    const session = await polar.checkouts.create(checkoutData);

    return NextResponse.json({ url: session.url })
}