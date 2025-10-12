import { NextRequest, NextResponse } from "next/server"
import { Polar } from "@polar-sh/sdk"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
        return NextResponse.json({ error: 'Missing User ID' }, { status: 400 })
    }

    const polar = new Polar({
        server: process.env.POLAR_ENV === 'sandbox' ? 'sandbox' : 'production',
        accessToken: process.env.POLAR_ACCESS_TOKEN!,
    })

    const session = await polar.checkouts.create({
        products: [process.env.POLAR_STANDARD_PLAN!],
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
        metadata: {
            userId
        }
    });

    return NextResponse.json({ url: session.url })
}