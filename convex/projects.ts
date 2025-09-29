import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getProject = query({
    args: { projectId: v.id('projects') },
    handler: async (ctx, { projectId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("User not authenticated!")

        const project = await ctx.db.get(projectId);
        if (!project) throw new Error("Project not found")

        if (project.userId !== userId && !project.isPublic) {
            throw new Error('Access Denied')
        }

        return project
    }
})