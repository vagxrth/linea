import { useLazyGetCheckoutQuery, useLazyGetPortalQuery } from "@/redux/api/billing";
import { useAppSelector } from "@/redux/store";
import { useQuery } from "convex/react";
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
