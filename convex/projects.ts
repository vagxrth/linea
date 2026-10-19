import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { deleteFileIfOwned } from "./storage";

// Takes the id straight from the URL. A malformed id, a missing project or one the caller can't
// see all return null, so pages can say "Project not found" instead of crashing.
export const getProject = query({
    args: { projectId: v.string() },
    handler: async (ctx, { projectId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null

        const id = ctx.db.normalizeId('projects', projectId);
        const project = id ? await ctx.db.get(id) : null;
        if (!project) return null

        if (project.userId !== userId && !project.isPublic) {
            return null
        }

        return project
    }
})

export const createProject = mutation({
    args: {
        name: v.optional(v.string()),
        sketchesData: v.any(),
        thumbnail: v.optional(v.string())
    },
    handler: async (ctx, { name, sketchesData, thumbnail }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        const projectNumber = await getNextProjectNumber(ctx, userId)
        const projectName = name || `Project ${projectNumber}`

        const projectId = await ctx.db.insert('projects', {
            userId,
            name: projectName,
            sketchesData,
            thumbnail,
            projectNumber,
            lastModified: Date.now(),
            createdAt: Date.now(),
            isPublic: false
        })

        return {
            projectId,
            name: projectName,
            projectNumber
        }
    }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getNextProjectNumber = async (ctx: any, userId: string): Promise<number> => {
    const counter = await ctx.db
        .query('project_counters')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex('by_userId', (q: any) => q.eq('userId', userId))
        .first()

    if (!counter) {
        await ctx.db.insert('project_counters', {
            userId,
            nextProjectNumber: 2,
        })
        return 1
    }

    const projectNumber = counter.nextProjectNumber

    await ctx.db.patch(counter._id, {
        nextProjectNumber: projectNumber + 1,
    })

    return projectNumber
}

export const getProjects = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, { limit = 20 }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return []

        const allProjects = await ctx.db
            .query('projects')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .order('desc')
            .collect()

        const projects = allProjects.slice(0, limit)

        return projects.map((project) => ({
            _id: project._id,
            name: project.name,
            projectNumber: project.projectNumber,
            thumbnail: project.thumbnail,
            lastModified: project.lastModified,
            createdAt: project.createdAt,
            isPublic: project.isPublic
        }));
    }
})

export const getStyleGuide = query({
    args: { projectId: v.id('projects') },
    handler: async (ctx, { projectId }) => {
        const userId = await getAuthUserId(ctx);
        if(!userId) throw new Error("User not authenticated!")

        const project = await ctx.db.get(projectId);
        if (!project) throw new Error("Project not found")

        if (project.userId !== userId && !project.isPublic) {
            throw new Error("Access denied")
        }

        return project.styleGuide ? JSON.parse(project.styleGuide) : null;
    }
})

export const updateProjectSketches = mutation({
    args: {
        projectId: v.id('projects'),
        sketchesData: v.any(),
        viewportData: v.optional(v.any())
    },
    handler: async (ctx, { projectId, sketchesData, viewportData }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        const project = await ctx.db.get(projectId);
        if (!project) throw new Error("Project not found")

        if (project.userId !== userId) {
            throw new Error("Access denied")
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {
            sketchesData,
            lastModified: Date.now(),
        }

        if (viewportData) {
            updateData.viewportData = viewportData;
        }

        await ctx.db.patch(projectId, updateData);
        return { success: true }
    }
})

export const updateProjectStyleGuide = mutation({
    args: {
        projectId: v.id('projects'),
        styleGuideData: v.any()
    },
    handler: async (ctx, { projectId, styleGuideData }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        const project = await ctx.db.get(projectId);
        if (!project) throw new Error("Project not found")

        if (project.userId !== userId) {
            throw new Error("Access denied")
        }

        await ctx.db.patch(projectId, {
            styleGuide: JSON.stringify(styleGuideData),
            lastModified: Date.now(),
        })

        return { success: true, styleGuide: styleGuideData }
    }
})

export const deleteProject = mutation({
    args: {
        projectId: v.id('projects'),
    },
    handler: async (ctx, { projectId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        const project = await ctx.db.get(projectId);
        if (!project) throw new Error("Project not found")

        if (project.userId !== userId) {
            throw new Error("Access denied")
        }

        // Before ownership was tracked a project could list another user's file, so only delete
        // the files this user owns.
        const storageIds = new Set([...(project.moodboardImages ?? []), ...(project.inspirationImages ?? [])])
        for (const storageId of storageIds) {
            await deleteFileIfOwned(ctx, storageId, userId)
        }

        await ctx.db.delete(projectId);

        return { success: true }
    }
})

export const renameProject = mutation({
    args: {
        projectId: v.id('projects'),
        name: v.string(),
    },
    handler: async (ctx, { projectId, name }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        const project = await ctx.db.get(projectId);
        if (!project) throw new Error("Project not found")

        if (project.userId !== userId) {
            throw new Error("Access denied")
        }

        const trimmedName = name.trim();
        if (!trimmedName) {
            throw new Error("Project name cannot be empty")
        }

        const lastModified = Date.now();
        await ctx.db.patch(projectId, {
            name: trimmedName,
            lastModified,
        });

        return { success: true, name: trimmedName, lastModified }
    }
})