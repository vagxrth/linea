import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ProjectSummary {
    _id: string
    name: string
    projectNumber: number
    thumbnail?: string
    lastModified: number
    createdAt: number
    isPublic?: boolean
}

interface ProjectState {
    projects: ProjectSummary[]
    total: number
    isLoading: boolean
    error: string | null
    lastFetched: number| null
    isCreating: boolean
    createError: string | null
}

const initialState: ProjectState = {
    projects: [],
    total: 0,
    isLoading: false,
    error: null,
    lastFetched: null,
    isCreating: false,
    createError: null
}

const projectSlice = createSlice({
    name: 'projects',
    initialState,
    reducers: {
        fetchProjectStart: (state) => {
            state.isLoading = true
            state.error = null
        },
        fetchProjectSuccess: (state, action: PayloadAction<{ projects: ProjectSummary[]; total: number }>) => {
            state.isLoading = false
            state.projects = action.payload.projects
            state.total = action.payload.total
            state.error = null
            state.lastFetched = Date.now()
        },
        fetchProjectFailure: (state, action: PayloadAction<string>) => {
            state.isLoading = false
            state.error = action.payload
        },

        createProjectStart: (state) => {
            state.isCreating = true
            state.createError = null
        },
        createProjectSuccess: (state) => {
            state.isCreating = false
            state.createError = null
        },
        createProjectFailure: (state, action: PayloadAction<string>) => {
            state.isCreating = false
            state.createError = action.payload
        },

        addProject: (state, action: PayloadAction<ProjectSummary>) => {
            state.projects.unshift(action.payload)
            state.total = +1
        },
        updateProject: (state, action: PayloadAction<ProjectSummary>) => {
            const index = state.projects.findIndex(
                (project) => project._id === action.payload._id
            )
            if (index !== -1) {
                state.projects[index] = { ...state.projects[index], ...action.payload }
            }
        },
        removeProject: (state, action: PayloadAction<string>) => {
            state.projects = state.projects.filter((project) => project._id !== action.payload)
            state.total = Math.max(0, state.total - 1)
        },

        clearProjects: (state) => {
            state.projects = []
            state.total = 0
            state.lastFetched = null
            state.error = null
            state.createError = null
        },
        clearErrors: (state) => {
            state.error = null;
            state.createError = null
        }
    }
})

export const {
    fetchProjectStart,
    fetchProjectSuccess,
    fetchProjectFailure,
    createProjectStart,
    createProjectSuccess,
    createProjectFailure,
    addProject,
    updateProject,
    removeProject,
    clearProjects,
    clearErrors
} = projectSlice.actions

export default projectSlice.reducer