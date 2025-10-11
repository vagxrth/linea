import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { isPolarWebhookEvent, PolarWebhookEvent } from "@/types/polar";
import { inngest } from "@/inngest/client";

export async function POST(request: NextRequest): Promise<NextResponse> {
    const secret = process.env.POLAR_WEBHOOK_SECRET ?? '';
    if (!secret) {
        return new NextResponse("Missing POLAR_WEBHOOK_SECRET", { status: 500 })
    }

    const raw = await request.arrayBuffer();
    const headersObject = Object.fromEntries(request.headers);

    let verified: unknown;

    try {
        verified = validateEvent(Buffer.from(raw), headersObject, secret);
    } catch (error) {
        if (error instanceof WebhookVerificationError) {
            return new NextResponse("Invalid signature", { status: 403 });
        }
        throw error
    }

    if (!isPolarWebhookEvent(verified)) {
        return new NextResponse("Unsupported event", { status: 400 });
    }

    const evt: PolarWebhookEvent = verified;
    const id = String(evt.id ?? Date.now());

    try {
        await inngest.send({
            name: "polar/webhook.received",
            id,
            data: evt
        })
    } catch (error) {
        console.error("Failed to send polar webhook event", error)
        return new NextResponse("Failed to send polar webhook event", { status: 500 })
    }
    return NextResponse.json({ ok: true });
}