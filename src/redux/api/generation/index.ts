import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const GenerationApi = createApi({
    reducerPath: 'generationApi',
    baseQuery: fetchBaseQuery({
        baseUrl: '/api/generate',
    }),
    tagTypes: ['Generation'],
    endpoints: (builder) => ({

        generateGeneration: builder.mutation({
            query: (data) => ({
                url: '/generate',
                method: 'POST',
                body: data,
            }),
        }),

        redesignUI: builder.mutation({
            query: (data)=> ({
                url: '/redesign',
                method: 'POST',
                body: data,
            }),
        }),

        generateWorkflow: builder.mutation({
            query: (data)=> ({
                url: '/workflow',
                method: 'POST',
                body: data,
            }),
        }),

        redesignWorkflow: builder.mutation({
            query: (data)=> ({
                url: '/workflow-redesign',
                method: 'POST',
                body: data,
            }),
        }),
    })
})

export const { useGenerateGenerationMutation, useRedesignUIMutation, useGenerateWorkflowMutation, useRedesignWorkflowMutation } = GenerationApi