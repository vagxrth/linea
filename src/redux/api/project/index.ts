import { fetchBaseQuery, createApi } from '@reduxjs/toolkit/query/react';
interface AutosaveProjectRequest {
    projectId: string
    userId: string
    shapesData: {
        shapes: Record<string, unknown>
        tool: string
        selected: Record<string, unknown>
        frameCounter: number
    }
    viewportData?: {
        scale: number
        translate: {
            x: number
            y: number
        }
    }
}


interface AutosaveProjectResponse {
    success: boolean
    message: string
    eventId: string
}

export const projectApi = createApi({
    reducerPath: 'projectApi',
    baseQuery: fetchBaseQuery({ baseUrl: '/api/project' }),
    tagTypes: ['Project'],
    endpoints: (builder) => ({
        autosaveProject: builder.mutation<AutosaveProjectResponse, AutosaveProjectRequest>({
            query: (data) => ({
                url: '',
                method: 'PATCH',
                body: data,
            })
        })
    })
})