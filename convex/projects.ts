import { v } from "convex/values";
import { internalMutation, mutation, query, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { deleteFileIfOwned } from "./storage";

// A project's drawing and viewport live in project_sketches, apart from the project itself
const getSketches = (ctx: QueryCtx, projectId: Id<'projects'>) =>
    ctx.db
        .query('project_sketches')
        .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
        .unique()

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

        // Projects the migration hasn't reached yet still carry their drawing themselves
        const sketches = await getSketches(ctx, project._id)
        return {
            ...project,
            sketchesData: sketches?.sketchesData ?? project.sketchesData,
            viewportData: sketches?.viewportData ?? project.viewportData,
        }
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
            thumbnail,
            projectNumber,
            lastModified: Date.now(),
            createdAt: Date.now(),
            isPublic: false
        })
        await ctx.db.insert('project_sketches', { projectId, sketchesData })

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

// All of the caller's projects, newest first. Drawings live in project_sketches, so this only
// reads the small project documents.
export const getProjects = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return []

        const projects = await ctx.db
            .query('projects')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .order('desc')
            .collect()

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

        const sketches = await getSketches(ctx, projectId)
        if (sketches) {
            await ctx.db.patch(sketches._id, viewportData ? { sketchesData, viewportData } : { sketchesData })
        } else {
            await ctx.db.insert('project_sketches', {
                projectId,
                sketchesData,
                viewportData: viewportData ?? project.viewportData,
            })
        }

        // Also drops the old copy from a project the migration hasn't reached yet
        await ctx.db.patch(projectId, {
            lastModified: Date.now(),
            sketchesData: undefined,
            viewportData: undefined,
        });
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

        const sketches = await getSketches(ctx, projectId)
        if (sketches) await ctx.db.delete(sketches._id)
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

// Moves each project's drawing and viewport into project_sketches. Run it once after deploying with
// `npx convex run projects:moveSketchesToOwnTable` (add `--prod` for production). It pages through
// projects and schedules itself until it reaches the end. Re-running it is harmless.
export const moveSketchesToOwnTable = internalMutation({
    args: { cursor: v.optional(v.string()) },
    handler: async (ctx, { cursor }) => {
        // Drawings can be a few hundred KB each, so batches stay small
        const { page, isDone, continueCursor } = await ctx.db
            .query('projects')
            .paginate({ cursor: cursor ?? null, numItems: 10 });

        for (const project of page) {
            if (project.sketchesData === undefined && project.viewportData === undefined) continue;

            // An autosave since the deploy already wrote a newer drawing there
            if (!(await getSketches(ctx, project._id))) {
                await ctx.db.insert('project_sketches', {
                    projectId: project._id,
                    sketchesData: project.sketchesData ?? null,
                    viewportData: project.viewportData,
                });
            }
            await ctx.db.patch(project._id, { sketchesData: undefined, viewportData: undefined });
        }

        if (isDone) {
            console.log("Moving project drawings finished");
        } else {
            await ctx.scheduler.runAfter(0, internal.projects.moveSketchesToOwnTable, { cursor: continueCursor });
        }
    },
});
