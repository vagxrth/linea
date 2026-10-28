import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { api } from "../../convex/_generated/api"
import { ConvexUserRaw, normalizeProfile } from "@/types/user"
import { Id } from "../../convex/_generated/dataModel"

// Server-side reads use fetchQuery, which returns plain values. preloadQuery is only for handing a
// query to usePreloadedQuery in a client component.

// The signed-in user's profile, or null when signed out
export const ProfileQuery = async () => {
    const user = await fetchQuery(
        api.user.getCurrentUser,
        {}, {
            token: await convexAuthNextjsToken()
        }
    )
    return normalizeProfile(user as ConvexUserRaw | null)
}

export const ProjectsQuery = async () => {
    const profile = await ProfileQuery();

    if (!profile?.id) {
        return { projects: null, profile: null }
    }

    const projects = await fetchQuery(
        api.projects.getProjects,
        {},
        { token: await convexAuthNextjsToken() }
    )

    return { projects, profile }
}

export const ProjectQuery = async (projectId: string) => {
    const profile = await ProfileQuery();

    if (!profile?.id || !projectId) {
        return { project: null, profile: null }
    }

    // getProject returns null for a malformed id or a project that's missing or not yours
    const project = await fetchQuery(
        api.projects.getProject,
        { projectId },
        { token: await convexAuthNextjsToken() }
    )

    return { project, profile }
}

export const StyleGuideQuery = async (projectId: string) => {
    const styleGuide = await fetchQuery(
        api.projects.getStyleGuide,
        { projectId: projectId as Id<'projects'>},
        { token: await convexAuthNextjsToken() }
    )

    return {styleGuide};
}

export const MoodboardImagesQuery = async (projectId: string) => {
    const images = await fetchQuery(
        api.moodboard.getMoodboardImages,
        { projectId: projectId as Id<'projects'>},
        { token: await convexAuthNextjsToken() }
    )

    return { images };
}

export const CreditsBalanceQuery = async () => {
    const profile = await ProfileQuery();

    if (!profile?.id) {
        return { ok: false, balance: 0, profile: null }
    }

    const balance = await fetchQuery(
        api.subscription.getCreditsBalance,
        {},
        { token: await convexAuthNextjsToken() }
    )

    return { ok: true, balance, profile }
}

export const ConsumeCreditsQuery = async ({ amount }: { amount?: number }) => {
    const profile = await ProfileQuery();

    if (!profile?.id) {
        return { ok: false, balance: 0, profile: null }
    }

    const credits = await fetchMutation(
        api.subscription.consumeCredits,
        {
            reason: 'ai-generation',
            amount: amount ?? 1,
        },
        { token: await convexAuthNextjsToken() }
    )

    return { ok: credits.ok, balance: credits.balance, profile }
}

export const InspirationImagesQuery = async (projectId: string) => {
    const images = await fetchQuery(
        api.inspiration.getInspirationImages,
        { projectId: projectId as Id<'projects'>},
        { token: await convexAuthNextjsToken() }
    )

    return { images };
}
