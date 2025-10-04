'use client'

import { addProject, createProjectFailure, createProjectStart, createProjectSuccess } from "@/redux/slice/projects"
import { useAppDispatch, useAppSelector } from "@/redux/store"
import { fetchMutation } from "convex/nextjs";
import { toast } from "sonner"
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const generateGradientThumbnail = () => {
    const gradients = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
        "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
        "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    ];

    const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
    const svgContent = `
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${randomGradient.match(/#[a-fA-F0-9]{6}/g)?.[0] || "#667eea"
        }" />
            <stop offset="100%" style="stop-color:${randomGradient.match(/#[a-fA-F0-9]{6}/g)?.[1] || "#764ba2"
        }" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <circle cx="150" cy="100" r="30" fill="white" opacity="0.8" />
        <path d="M140 90 L160 90 L160 110 L140 110 Z" fill="white" opacity="0.6" />
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svgContent)}`;
};

export const useProjectCreation = () => {
    const dispatch = useAppDispatch()
    const user = useAppSelector((state) => state.profile)
    const projectState = useAppSelector((state) => state.projects)
    const shapesState = useAppSelector((state) => state.shapes)

    const createProject = async (name?: string) => {
        if (!user?.id) {
            toast.error('Please sign in to create project')
            return
        }
        dispatch(createProjectStart());
        try {
            const thumbnail = generateGradientThumbnail();
            const result = await fetchMutation(api.projects.createProject, {
                userId: user.id as Id<'users'>,
                name: name || undefined,
                sketchesData: {
                    shapes: shapesState.shapes,
                    tool: shapesState.tool,
                    selected: shapesState.selected,
                    frameCounter: shapesState.frameCounter,
                },
                thumbnail,
            })

            dispatch(addProject({
                _id: result.projectId,
                name: result.name,
                projectNumber: result.projectNumber,
                thumbnail,
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

    return {
        createProject,
        isCreating: projectState.isCreating,
        projects: projectState.projects,
        projectsTotal: projectState.total,
        canCreate: !!user?.id,

    }
}