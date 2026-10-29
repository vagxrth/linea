import { useLazyGetCheckoutQuery, useLazyGetPortalQuery } from "@/redux/api/billing";
import { useAppSelector } from "@/redux/store";
import { useConvex, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

export const useSubscription = () => {
    const [trigger, { isFetching: isFetchingCheckout }] = useLazyGetCheckoutQuery()
    const [triggerPortal, { isFetching: isFetchingPortal }] = useLazyGetPortalQuery()
    // undefined while loading
    const isSubscribed = useQuery(api.subscription.hasEntitlement, {})

    const profile = useAppSelector((state) => state.profile)
    const onSubscribe = async () => {
        if (!profile?.id) {
            toast.error('Please sign in to subscribe')
            return
        }
        try {
            const res = await trigger().unwrap()
            window.location.href = res.url
        } catch (error) {
            console.error(error)
            if ((error as { status?: number })?.status === 409) {
                toast.info('You already have a subscription. Use Manage plan to change it.')
            } else {
                toast.error('Failed to subscribe')
            }
        }
    }

    const onManage = async () => {
        try {
            const res = await triggerPortal().unwrap()
            window.location.href = res.url
        } catch (error) {
            console.error(error)
            toast.error('Could not open the billing portal')
        }
    }

    return { onSubscribe, onManage, isSubscribed, isFetching: isFetchingCheckout || isFetchingPortal }
}

// For a generation refused because the user is out of credits (HTTP 402). Without a plan, it points
// to Linea Pro. Pass the id of a loading toast to replace it.
export const useOutOfCredits = () => {
    const convex = useConvex()
    const router = useRouter()
    // As in the navbar: the URL's name segment stands in when the profile couldn't load
    const name = useAppSelector((state) => state.profile?.name)
    const { slug } = useParams<{ slug?: string }>()

    // Asks about the plan only when needed, so the function keeps its identity for callbacks using it
    return useCallback(async (id: string | number = 'out-of-credits') => {
        const isSubscribed = await convex.query(api.subscription.hasEntitlement, {}).catch(() => false)
        if (isSubscribed) {
            toast.error("You're out of credits", { id, description: "Your plan's credits refill every month." })
            return
        }
        toast.error("You're out of credits", {
            id,
            description: 'Linea Pro gives you 100 credits a month.',
            action: { label: 'See plans', onClick: () => router.push(`/billing/${name ?? slug}`) },
            duration: 10000,
        })
    }, [convex, router, name, slug])
}
