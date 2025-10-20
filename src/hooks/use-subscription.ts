import { useLazyGetCheckoutQuery } from "@/redux/api/billing";
import { useAppSelector } from "@/redux/store";
import { toast } from "sonner";

export const useSubscription = () => {
    const [trigger, { isFetching }] = useLazyGetCheckoutQuery()

    const profile = useAppSelector((state) => state.profile)
    const onSubscribe = async () => {
        if (!profile?.id) {
            toast.error('Please sign in to subscribe')
            return
        }
        try {
            const res = await trigger(profile.id).unwrap()
            window.location.href = res.url
        } catch (error) {
            console.error(error)
            toast.error('Failed to subscribe')
        }
    }

    return { onSubscribe, isFetching }
}