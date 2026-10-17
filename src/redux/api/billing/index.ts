import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const BillingApi = createApi({
    reducerPath: 'billing',
    baseQuery: fetchBaseQuery({ baseUrl: '/api/billing' }),
    endpoints: (builder) => ({
        // The checkout route reads the user from the session cookie
        getCheckout: builder.query<{ url: string }, void>({
            query: () => ({
                url: '/checkout',
                method: 'GET',
            })
        })
    }),
})

export const { useLazyGetCheckoutQuery } = BillingApi;
