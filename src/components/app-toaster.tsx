'use client'

import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { Toaster } from '@/components/ui/sonner'

// The canvas's tools take one row along the bottom from the md breakpoint (768px) up, and two below it
const WIDE = '(min-width: 768px)'
const subscribe = (onChange: () => void) => {
    const query = window.matchMedia(WIDE)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}
const isWide = () => window.matchMedia(WIDE).matches

// Toasts sit at the bottom right, except on the canvas, where the zoom controls are. There they go to
// the bottom center, just above the tools, like on other canvases, and clear of the chat panel at
// the right. The tools take the bottom 86px in one row, 136px in two.
const AppToaster = () => {
    const onCanvas = usePathname().endsWith('/canvas')
    const wide = useSyncExternalStore(subscribe, isWide, () => true)

    if (!onCanvas) return <Toaster />
    return (
        <Toaster
            position='bottom-center'
            offset={{ bottom: wide ? 112 : 160 }}
            // Sonner's own layout for screens under 600px wide
            mobileOffset={{ bottom: 160 }}
        />
    )
}

export default AppToaster
