import { Id } from './../../convex/_generated/dataModel.d';
export interface PolarWebhookEvent<TData = unknown> {
    id: string | number;
    type: string;
    data: TData;
}

export type ReceivedEvent = PolarWebhookEvent<unknown>

export const isPolarWebhookEvent = (x: unknown): x is PolarWebhookEvent<unknown> => {
    return (
        !!x &&
        typeof x === 'object' &&
        'type' in (x as Record<string, unknown>) &&
        'data' in (x as Record<string, unknown>)
    )
}

export interface PolarCustomer {
    id: string
    email: string | null
}

export interface PolarProduct {
    id?: string | null
    name?: string | null
}

export interface PolarPrice {
    id?: string | null
    recurring_interval?: string | null
}

export interface PolarSubscription {
    id: string
    status: string
    current_period_end?: string | null
    trial_ends_at?: string | null
    cancel_at?: string | null
    cancelled_at?: string | null
    customer?: PolarCustomer | null
    customer_id?: string | null
    product?: PolarProduct | null
    product_id?: string | null
    prices?: PolarPrice[] | null
    seats?: number | null
    plan_code?: string | null
    metadata?: Record<string, unknown> | null
}

export const extractSubscription = (data: unknown): PolarSubscription | null => {
    if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>
        const sub = (
            d.subscription && typeof d.subscription === 'object' ? (d.subscription as Record<string, unknown>) : d
        ) as Record<string, unknown>

        const id = sub.id
        const status = sub.status
        if (typeof id === 'string' && typeof status === 'string') {
            return {
                id,
                status,
                current_period_end: sub.current_period_end as string | undefined | null,
                trial_ends_at: sub.trial_ends_at as string | undefined | null,
                cancel_at: sub.cancel_at as string | undefined | null,
                cancelled_at: sub.cancelled_at as string | undefined | null,
                customer: sub.customer as PolarCustomer | undefined | null,
                customer_id: sub.customer_id as string | undefined | null,
                product: sub.product as PolarProduct | undefined | null,
                product_id: sub.product_id as string | undefined | null,
                prices: sub.prices as PolarPrice[] | undefined | null,
                seats: (typeof sub.seats === 'number' ? sub.seats : undefined) ?? null,
                plan_code: sub.plan_code as string | undefined | null,
                metadata: (sub.metadata as Record<string, unknown> | undefined) ?? null,
            }
        }
    }
    return null
}

export interface PolarOrder {
    id: string
    billing_reason?: string | null
    subscription_id?: string | null
    customer?: PolarCustomer | null
    customer_id?: string | null
    metadata?: Record<string, unknown> | null
}

export const extractOrder = (data: unknown): PolarOrder | null => {
    if (!data || typeof data !== 'object') return null
    const d = data as Record<string, unknown>
    const id = d.Id
    if (typeof id !== 'string') return null
    return {
        id,
        billing_reason: d.billing_reason as string | undefined | null,
        subscription_id: d.subscription_id as string | undefined | null,
        customer: d.customer as PolarCustomer | undefined | null,
        customer_id: d.customer_id as string | undefined | null,
        metadata: (d.metadata as Record<string, unknown> | undefined) ?? null,
    }
}

export const toMs = (x: string | number | null | undefined): number | undefined => {
    if (x == null) return undefined
    if (typeof x === 'number') return x
    const t = Date.parse(x)
    return Number.isNaN(t) ? undefined : t
}