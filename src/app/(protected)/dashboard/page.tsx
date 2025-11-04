import { ProfileQuery } from "@/convex/query.config";
import { combinedSlug } from "@/lib/utils";
import { redirect } from "next/navigation";
import { ConvexUserRaw, normalizeProfile } from "@/types/user";

const Dashboard = async () => {

    const rawProfile = await ProfileQuery();
    const profile = normalizeProfile(
        rawProfile._valueJSON as unknown as ConvexUserRaw | null
    );

    if (!profile?.name) {
        redirect('/auth/signin');
    }
    redirect(`/dashboard/${combinedSlug(profile.name)}`)
}

export default Dashboard;