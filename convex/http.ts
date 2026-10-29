import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { CREDITS_PER_MONTH } from "./subscription";
import { entitledStatus, extractOrder, extractSubscription, isPolarWebhookEvent, toMs } from "../src/types/polar";

const http = httpRouter();

auth.addHttpRoutes(http);

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

const decodeBase64 = (value: string) => {
    try {
        return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    } catch {
        return null;
    }
};

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
    a.byteLength === b.byteLength && a.every((byte, i) => byte === b[i]);

// The keys Polar may sign with (https://polar.sh/docs/integrate/webhooks/delivery#custom-validation).
// Secrets generated before 8 September 2026 sign with the UTF-8 bytes of the whole "whsec_..." string;
// newer ones follow Standard Webhooks and sign with the base64-decoded part after "whsec_". Both are
// tried, as @polar-sh/sdk's validateEvent does, so either kind of secret works.
const signingKeys = (secret: string) => {
    const keys = [new TextEncoder().encode(secret)];
    const decoded = decodeBase64(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret);
    if (decoded && decoded.byteLength > 0 && !sameBytes(decoded, keys[0])) keys.push(decoded);
    return keys;
};

// Standard Webhooks signature check, matching @polar-sh/sdk's validateEvent: an HMAC-SHA256 of
// "<webhook-id>.<webhook-timestamp>.<raw body>" keyed with one of signingKeys, sent as
// space-separated "v1,<base64>" entries in the webhook-signature header.
const hasValidSignature = async (request: Request, body: string, secret: string): Promise<boolean> => {
    const id = request.headers.get('webhook-id');
    const timestamp = request.headers.get('webhook-timestamp');
    const signatures = request.headers.get('webhook-signature');
    if (!id || !timestamp || !signatures) return false;

    const seconds = Number.parseInt(timestamp, 10);
    if (Number.isNaN(seconds) || Math.abs(Date.now() / 1000 - seconds) > WEBHOOK_TOLERANCE_SECONDS) {
        return false;
    }

    const keys = await Promise.all(
        signingKeys(secret).map((raw) =>
            crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']),
        ),
    );
    const signedContent = new TextEncoder().encode(`${id}.${seconds}.${body}`);

    for (const entry of signatures.split(' ')) {
        const [version, signature] = entry.split(',');
        if (version !== 'v1' || !signature) continue;

        const bytes = decodeBase64(signature);
        if (!bytes) continue;
        for (const key of keys) {
            if (await crypto.subtle.verify('HMAC', key, bytes, signedContent)) return true;
        }
    }
    return false;
};

// Polar billing events: verify the signature, then sync the subscription and grant the period's
// credits through internal functions that no client can call.
const polarWebhook = httpAction(async (ctx, request) => {
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    if (!secret) {
        console.error('POLAR_WEBHOOK_SECRET is not set on the Convex deployment');
        return new Response('Missing POLAR_WEBHOOK_SECRET', { status: 500 });
    }

    const body = await request.text();
    if (!(await hasValidSignature(request, body, secret))) {
        return new Response('Invalid signature', { status: 403 });
    }

    let event: unknown;
    try {
        event = JSON.parse(body);
    } catch {
        return new Response('Invalid payload', { status: 400 });
    }
    if (!isPolarWebhookEvent(event)) {
        return new Response('Unsupported event', { status: 400 });
    }

    // Only subscription and order events describe a purchase. Checkout, refund and customer
    // payloads also have an id (and often a status), so the extractors below would misread them.
    if (!/^(subscription|order)\./.test(event.type)) {
        return new Response('Ignored', { status: 200 });
    }

    const data = event.data;
    const subscription = extractSubscription(data);
    const order = extractOrder(data);
    if (!subscription && !order) {
        return new Response('Ignored', { status: 200 });
    }

    const metadataUserId = [subscription?.metadata?.userId, order?.metadata?.userId]
        .find((value): value is string => typeof value === 'string');

    const userId = await ctx.runQuery(internal.user.resolveUserId, {
        userId: metadataUserId,
        email: subscription?.customer?.email ?? order?.customer?.email ?? undefined,
    });
    if (!userId) {
        console.warn(`Polar ${event.type}: no matching user`);
        return new Response('Ignored', { status: 200 });
    }

    // For one-time purchases, use order ID; for subscriptions, use subscription ID
    const polarSubscriptionId = subscription?.id ?? order?.subscription_id ?? order?.id ?? '';
    if (!polarSubscriptionId) {
        return new Response('Ignored', { status: 200 });
    }

    const currentPeriodEnd = toMs(subscription?.current_period_end);

    // For one-time purchases (an order without a subscription), set status to 'active' to pass entitlement checks
    const isOneTimePurchase = !subscription && !!order;
    const status = subscription?.status ?? (isOneTimePurchase ? 'active' : 'updated');

    const subscriptionId = await ctx.runMutation(internal.subscription.upsertFromPolar, {
        userId,
        polarCustomerId: subscription?.customer?.id ?? subscription?.customer_id ?? order?.customer_id ?? '',
        polarSubscriptionId,
        productId: subscription?.product_id ?? subscription?.product?.id ?? undefined,
        priceId: subscription?.prices?.[0]?.id ?? undefined,
        planCode: subscription?.plan_code ?? subscription?.product?.name ?? 'credit-purchase',
        status,
        recurringInterval: subscription?.recurring_interval ?? undefined,
        currentPeriodStart: toMs(subscription?.current_period_start),
        currentPeriodEnd,
        trialEndsAt: toMs(subscription?.trial_ends_at),
        cancelAt: toMs(subscription?.cancel_at),
        cancelledAt: toMs(subscription?.cancelled_at),
        seats: subscription?.seats ?? undefined,
        creditsGrantPerPeriod: CREDITS_PER_MONTH,
        creditsRolloverLimit: CREDITS_PER_MONTH,
    });

    if (entitledStatus(status)) {
        // One grant per billing period, which for a yearly plan is its first month (refillYearlyCredits
        // grants the rest); purchases without a period are granted once
        await ctx.runMutation(internal.subscription.grantCredits, {
            subscriptionId,
            idempotencyKey: `${polarSubscriptionId}:${currentPeriodEnd ?? 'first'}`,
            amount: CREDITS_PER_MONTH,
            reason: event.type === 'subscription.created' ? 'initial-grant' : 'period-grant',
        });
    }

    return new Response('OK', { status: 200 });
});

http.route({
    path: '/polar/webhook',
    method: 'POST',
    handler: polarWebhook,
});

export default http;
