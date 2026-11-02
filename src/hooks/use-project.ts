'use client'

import { addProject, createProjectFailure, createProjectStart, createProjectSuccess, removeProject, updateProject } from "@/redux/slice/projects"
import { useAppDispatch, useAppSelector } from "@/redux/store"
import { useMutation } from "convex/react";
import { toast } from "sonner"
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Initial empty document for new projects (the persisted part of the Redux shapes state)
const EMPTY_SKETCHES_DATA = {
    shapes: { ids: [], entities: {} },
    frameCounter: 0,
}

export const useProjectCreation = () => {
    const dispatch = useAppDispatch()
    const user = useAppSelector((state) => state.profile)
    const projectState = useAppSelector((state) => state.projects)
    const createProjectMutation = useMutation(api.projects.createProject)
    const deleteProjectMutation = useMutation(api.projects.deleteProject)
    const renameProjectMutation = useMutation(api.projects.renameProject)

    const createProject = async (name?: string) => {
        if (!user?.id) {
            toast.error('Please sign in to create project')
            return
        }
        dispatch(createProjectStart());
        try {
            // No thumbnail: the dashboard shows a dark sketch placeholder for a project without one
            const result = await createProjectMutation({
                name: name || undefined,
                sketchesData: EMPTY_SKETCHES_DATA,
            })

            dispatch(addProject({
                _id: result.projectId,
                name: result.name,
                projectNumber: result.projectNumber,
                lastModified: Date.now(),
                createdAt: Date.now(),
                isPublic: false
            }))
            dispatch(createProjectSuccess())
            toast.success('Project created successfully!')
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            dispatch(createProjectFailure('Failed to create project'))
            toast.error('Failed to create project')
        }
    }

    const deleteProject = async (projectId: string) => {
        if (!user?.id) {
            toast.error('Please sign in to delete project')
            return
        }
        try {
            await deleteProjectMutation({
                projectId: projectId as Id<'projects'>,
            })
            dispatch(removeProject(projectId))
            toast.success('Project deleted successfully!')
        } catch (error) {
            console.error('Failed to delete project:', error)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            toast.error(`Failed to delete project: ${errorMessage}`)
        }
    }

    const renameProject = async (projectId: string, name: string) => {
        if (!user?.id) {
            toast.error('Please sign in to rename project')
            return false
        }
        try {
            const result = await renameProjectMutation({
                projectId: projectId as Id<'projects'>,
                name,
            })
            if (result.success) {
                dispatch(updateProject({
                    _id: projectId,
                    name: result.name,
                    lastModified: result.lastModified,
                }))
                toast.success('Project renamed successfully!')
                return true
            }
            return false
        } catch (error) {
            console.error('Failed to rename project:', error)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            toast.error(`Failed to rename project: ${errorMessage}`)
            return false
        }
    }

    return {
        createProject,
        deleteProject,
        renameProject,
        isCreating: projectState.isCreating,
        projects: projectState.projects,
        projectsTotal: projectState.total,
        canCreate: !!user?.id,
    }
}