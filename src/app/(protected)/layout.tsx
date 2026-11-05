import React from 'react'
import ReduxProvider from '@/redux/provider'
import { ProfileQuery } from '@/convex/query.config'

type Props = {
    children: React.ReactNode
}

// Only the signed-in pages use the store, so the profile is looked up here. In the root layout,
// the landing, pitch and sign-in pages would each wait on Convex for a profile they never read.
const Layout = async ({ children }: Props) => {

    let profile = null;
    try {
        profile = await ProfileQuery();
    } catch (error) {
        // Gracefully handle profile query errors instead of crashing
        console.error('Profile query error:', error);
        profile = null;
    }

    return (
        <ReduxProvider preloadedState={{ profile }}>
            {/* Lighter secondary text on the signed-in pages (globals.css). contents: no box, so layout is untouched. */}
            <div data-app-chrome className='contents'>
                {children}
            </div>
        </ReduxProvider>
    )
}

export default Layout
