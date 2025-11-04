import Navbar from '@/components/navbar';
import { SubscriptionQuery } from '@/convex/query.config';
import { combinedSlug } from '@/lib/utils';
import { redirect } from 'next/navigation';
import React from 'react'

type Props = {
    children: React.ReactNode
}

const Layout = async ({ children }: Props) => {

    const { profileName, entitlement } = await SubscriptionQuery();
    
    if (!profileName) {
        redirect('/auth/signin');
    }
    if (!entitlement._valueJSON) {
        redirect(`/billing/${combinedSlug(profileName)}`)
    }

    return (
        <div className='grid grid-cols-1'>
            <Navbar />
            {children}
        </div>
    )
}

export default Layout