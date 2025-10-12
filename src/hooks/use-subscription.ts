import { useLazyGetCheckoutQuery } from "@/redux/api/billing";
import { useAppSelector } from "@/redux/store";
import { toast } from "sonner";

export const useSubscription = () => {
    const [trigger, { isFetching }] = useLazyGetCheckoutQuery()

    const { id } = useAppSelector((state) => state.profile)
    const onSubscribe = async () => {
        try {
            const res = await trigger(id).unwrap()
            window.location.href = res.url
        } catch (error) {
            console.error(error)
            toast.error('Failed to subscribe')
        }
    }

    return { onSubscribe, isFetching }
}