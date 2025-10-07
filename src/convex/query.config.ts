import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { preloadQuery } from "convex/nextjs"
import { api } from "../../convex/_generated/api"
import { ConvexUserRaw, normalizeProfile } from "@/types/user"
import { Id } from "../../convex/_generated/dataModel"

export const ProfileQuery = async () => {
    return await preloadQuery(
        api.user.getCurrentUser,
        {}, {
            token: await convexAuthNextjsToken()
        }
    )
}

export const SubscriptionQuery = async () => {
    const rawProfile = await ProfileQuery();

    const profile = normalizeProfile(
        rawProfile._valueJSON as unknown as ConvexUserRaw | null
    )

    const entitlement = await preloadQuery(
        api.subscription.hasEntitlement,
        { userId: profile?.id as Id<'users'>},
        { token: await convexAuthNextjsToken()}
    )

    return { entitlement, profileName: profile?.name };

}

export const ProjectsQuery = async () => {
    const rawProfile = await ProfileQuery();
    const profile = normalizeProfile(
        rawProfile._valueJSON as unknown as ConvexUserRaw | null
    )

    if (!profile?.id) {
        return { projects: null, profile: null }
    }

    const projects = await preloadQuery(
        api.projects.getProjects,
        { userId: profile.id as Id<'users'>},
        { token: await convexAuthNextjsToken() }
    )

    return { projects, profile }
}

export const ProjectQuery = async (projectId: string) => {
    const rawProfile = await ProfileQuery();
    const profile = normalizeProfile(rawProfile._valueJSON as unknown as ConvexUserRaw | null)

    if (!profile?.id || !projectId) {
        return { project: null, profile: null }
    }

    const project = await preloadQuery(
        api.projects.getProject,
        { projectId: projectId as Id<'projects'>},
        { token: await convexAuthNextjsToken() }
    )

    return { project, profile }
}

export const StyleGuideQuery = async (projectId: string) => {
    const styleGuide = await preloadQuery(
        api.projects.getStyleGuide,
        { projectId: projectId as Id<'projects'>},
        { token: await convexAuthNextjsToken() }
    )

    return {styleGuide};
}

export const MoodboardImagesQuery = async (projectId: string) => {
    const images = await preloadQuery(
        api.moodboard.getMoodboardImages,
        { projectId: projectId as Id<'projects'>},
        { token: await convexAuthNextjsToken() }
    )

    return { images };
}