import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BillingPeriod } from "@/lib/plans";

export const BillingApi = createApi({
    reducerPath: 'billing',
    baseQuery: fetchBaseQuery({ baseUrl: '/api/billing' }),
    endpoints: (builder) => ({
        // Both routes read the user from the session cookie
        // Checkout opens with this period's plan selected
        getCheckout: builder.query<{ url: string }, BillingPeriod>({
            query: (period) => ({
                url: `/checkout?period=${period}`,
                method: 'GET',
            })
        }),
        getPortal: builder.query<{ url: string }, void>({
            query: () => ({
                url: '/portal',
                method: 'GET',
            })
        })
    }),
})

export const { useLazyGetCheckoutQuery, useLazyGetPortalQuery } = BillingApi;
