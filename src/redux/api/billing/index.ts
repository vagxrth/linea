import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const BillingApi = createApi({
    reducerPath: 'billing',
    baseQuery: fetchBaseQuery({ baseUrl: '/api/billing' }),
    endpoints: (builder) => ({
        // Both routes read the user from the session cookie
        getCheckout: builder.query<{ url: string }, void>({
            query: () => ({
                url: '/checkout',
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
