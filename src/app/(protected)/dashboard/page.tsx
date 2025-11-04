import { SubscriptionQuery } from "@/convex/query.config";
import { combinedSlug } from "@/lib/utils";
import { redirect } from "next/navigation";

const Dashboard = async () => {

    const { profileName } = await SubscriptionQuery();

    if (!profileName) {
        redirect('/auth/signin');
    }
    redirect(`/dashboard/${combinedSlug(profileName)}`)
}

export default Dashboard;