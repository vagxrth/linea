import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMoodboardImages = query({
    args: { projectId: v.id('projects') },
    handler: async (ctx, { projectId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return []

        const project = await ctx.db.get(projectId);
        if (!project || project.userId !== userId) {
            return []
        }

        const storageIds = project.moodboardImages || [];
        const images = await Promise.all(
            storageIds.map(async (storageId, index) => {
                try {
                    const url = await ctx.storage.getUrl(storageId);
                    return {
                        id: `convex-${storageId}`,
                        storageId,
                        url,
                        uploaded: true,
                        uploading: false,
                        index,
                    }
                } catch (error) {
                    return null
                }
            })
        )
        return images
            .filter((image) => image !== null)
            .sort((a, b) => a!.index - b!.index)
    }
})

export const generateUploadUrl = mutation({
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        return await ctx.storage.generateUploadUrl()
    }
})

export const removeMoodboardImage = mutation({
    args: {
        projectId: v.id('projects'),
        storageId: v.id('_storage'),
    },
    handler: async (ctx, { projectId, storageId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        const project = await ctx.db.get(projectId);
        if (!project) {
            throw new Error("Project not found")
        }

        if (project.userId !== userId) {
            throw new Error("Access denied")
        }

        const currentImages = project.moodboardImages || [];
        const updatedImages = currentImages.filter((id) => id !== storageId);

        await ctx.db.patch(projectId, {
            moodboardImages: updatedImages,
            lastModified: Date.now(),
        })

        try {
            await ctx.storage.delete(storageId);
        } catch (error) {
            console.error(`Failed to delete image from storage ${storageId} `, error);
        }

        return { success: true, imageCount: updatedImages.length }
    }
})

export const addMoodboardImage = mutation({
    args: {
        projectId: v.id('projects'),
        storageId: v.id('_storage'),
    },
    handler: async (ctx, { projectId, storageId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        const project = await ctx.db.get(projectId)
        if (!project) throw new Error('Project not found')

        if (project.userId !== userId) throw new Error('Access denied')

        const currentImages = project.moodboardImages || []
        if (currentImages.length >= 5) {
            throw new Error('You can only add up to 5 images')
        }

        const updatedImages = [...currentImages, storageId]
        await ctx.db.patch(projectId, {
            moodboardImages: updatedImages,
            lastModified: Date.now()
        })

        return { success: true, imageCount: updatedImages.length }
    }
})