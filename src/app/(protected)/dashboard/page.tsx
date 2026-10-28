import { ProfileQuery } from "@/convex/query.config";
import { redirect } from "next/navigation";

const Dashboard = async () => {

    const profile = await ProfileQuery();

    if (!profile?.name) {
        redirect('/auth/signin');
    }
    redirect(`/dashboard/${profile.name}`)
}

export default Dashboard;