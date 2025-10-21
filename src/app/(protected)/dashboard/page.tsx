import { SubscriptionQuery } from "@/convex/query.config";
import { combinedSlug } from "@/lib/utils";
import { redirect } from "next/navigation";

const Dashboard = async () => {

    const { entitlement, profileName } = await SubscriptionQuery();

    if (!profileName) {
        redirect('/auth/signin');
    }
    // TODO: Uncomment this when the billing is implemented
    // if (!entitlement._valueJSON) {
    //     redirect(`/billing/${combinedSlug(profileName)}`)
    // }
    redirect(`/dashboard/${combinedSlug(profileName)}`)
}

export default Dashboard;