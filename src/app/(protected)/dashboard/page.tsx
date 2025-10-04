import { SubscriptionQuery } from "@/convex/query.config";
import { combinedSlug } from "@/lib/utils";
import { redirect } from "next/navigation";

const Dashboard = async () => {

    const { entitlement, profileName } = await SubscriptionQuery();

    if (!entitlement._valueJSON) {
        // TODO: hook up billing logic
        redirect(`/dashboard/${combinedSlug(profileName!)}`)
    }
    redirect(`/dashboard/${combinedSlug(profileName!)}`)
}

export default Dashboard;