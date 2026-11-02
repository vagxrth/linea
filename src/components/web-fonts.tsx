'use client'

import { useEffect } from 'react'
import { loadWebFonts } from '@/lib/web-fonts'

// Loads the web fonts among these font-family values into the page, after it shows. Renders nothing.
const WebFonts = ({ families }: { families: string[] }) => {
    const key = families.join('|')

    useEffect(() => {
        loadWebFonts(document, key.split('|'))
    }, [key])

    return null
}

export default WebFonts
