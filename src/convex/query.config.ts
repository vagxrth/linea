import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { fetchMutation, preloadQuery } from "convex/nextjs"
import { api } from "../../convex/_generated/api"
import { ConvexUserRaw, normalizeProfile } from "@/types/user"
import { Id } from "../../convex/_generated/dataModel"

export const ProfileQuery = async () => {
    try {
        return await preloadQuery(
            api.user.getCurrentUser,
            {}, {
                token: await convexAuthNextjsToken()
            }
        )
    } catch (error) {
        console.error('Error in ProfileQuery:', error);
        return { _valueJSON: null };
    }
}

export const SubscriptionQuery = async () => {
    try {
        const rawProfile = await ProfileQuery();

        const profile = normalizeProfile(
            rawProfile._valueJSON as unknown as ConvexUserRaw | null
        )

        if (!profile?.id) {
            return { entitlement: { _valueJSON: null }, profileName: null };
        }

        const entitlement = await preloadQuery(
            api.subscription.hasEntitlement,
            { userId: profile.id as Id<'users'>},
            { token: await convexAuthNextjsToken()}
        )

        return { entitlement, profileName: profile.name };
    } catch (error) {
        console.error('Error in SubscriptionQuery:', error);
        return { entitlement: { _valueJSON: null }, profileName: null };
    }

}

export const ProjectsQuery = async () => {
    try {
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
    } catch (error) {
        console.error('Error in ProjectsQuery:', error);
        return { projects: null, profile: null }
    }
}

export const ProjectQuery = async (projectId: string) => {
    try {
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
    } catch (error) {
        console.error('Error in ProjectQuery:', error);
        return { project: null, profile: null }
    }
}

export const StyleGuideQuery = async (projectId: string) => {
    try {
        const styleGuide = await preloadQuery(
            api.projects.getStyleGuide,
            { projectId: projectId as Id<'projects'>},
            { token: await convexAuthNextjsToken() }
        )

        return {styleGuide};
    } catch (error) {
        console.error('Error in StyleGuideQuery:', error);
        return { styleGuide: null };
    }
}

export const MoodboardImagesQuery = async (projectId: string) => {
    try {
        const images = await preloadQuery(
            api.moodboard.getMoodboardImages,
            { projectId: projectId as Id<'projects'>},
            { token: await convexAuthNextjsToken() }
        )

        return { images };
    } catch (error) {
        console.error('Error in MoodboardImagesQuery:', error);
        return { images: null };
    }
}

export const CreditsBalanceQuery = async () => {
    try {
        const rawProfile = await ProfileQuery();
        const profile = normalizeProfile(rawProfile._valueJSON as unknown as ConvexUserRaw | null)

        if (!profile?.id) {
            return { ok: false, balance: 0, profile: null }
        }

        const balance = await preloadQuery(
            api.subscription.getCreditsBalance,
            { userId: profile.id as Id<'users'>},
            { token: await convexAuthNextjsToken() }
        )

        return { ok: true, balance: balance._valueJSON, profile }
    } catch (error) {
        console.error('Error in CreditsBalanceQuery:', error);
        return { ok: false, balance: 0, profile: null }
    }
}

export const ConsumeCreditsQuery = async ({ amount }: { amount?: number }) => {
    try {
        const rawProfile = await ProfileQuery();
        const profile = normalizeProfile(rawProfile._valueJSON as unknown as ConvexUserRaw | null)

        if (!profile?.id) {
            return { ok: false, balance: 0, profile: null }
        }

        const credits = await fetchMutation(
            api.subscription.consumeCredits,
            {
                reason: 'ai-generation',
                userId: profile.id as Id<'users'>,
                amount: amount ?? 1,
            },
            { token: await convexAuthNextjsToken() }
        )

        return { ok: credits.ok, balance: credits.balance, profile }
    } catch (error) {
        console.error('Error in ConsumeCreditsQuery:', error);
        return { ok: false, balance: 0, profile: null }
    }
}

export const InspirationImagesQuery = async (projectId: string) => {
    try {
        const images = await preloadQuery(
            api.inspiration.getInspirationImages,
            { projectId: projectId as Id<'projects'>},
            { token: await convexAuthNextjsToken() }
        )

        return { images };
    } catch (error) {
        console.error('Error in InspirationImagesQuery:', error);
        return { images: null };
    }
}