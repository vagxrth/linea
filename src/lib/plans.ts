// Linea Pro is sold monthly and, when a second product is set up, yearly
export type BillingPeriod = 'monthly' | 'yearly'

// POLAR_PLAN holds Linea Pro's Polar product ids, comma-separated: monthly first, then yearly.
// Server only: the variable isn't sent to the browser.
export const planProductIds = (plan = process.env.POLAR_PLAN) =>
    (plan ?? '').split(',').map((id) => id.trim()).filter(Boolean)

// Polar's checkout offers every product it's given, with the first one selected, so the period
// picked on the billing page goes first. The other stays, so the buyer can still switch.
export const checkoutProducts = (ids: string[], period: BillingPeriod) =>
    period === 'yearly' && ids.length > 1 ? [ids[1], ids[0], ...ids.slice(2)] : ids
