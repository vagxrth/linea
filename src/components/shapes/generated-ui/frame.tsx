import React, { useEffect, useRef, useState } from 'react'

type Props = {
    html: string,
    onResize: (height: number) => void
}

// The sandbox leaves out allow-scripts, allow-forms and allow-popups, so nothing in a design can run, submit or open
// a window. allow-same-origin only lets the app fill the page in, measure it and export it.
const BLANK_PAGE = '<!doctype html><html class="dark" style="color-scheme: dark; overflow: hidden"><head><meta charset="utf-8"></head><body style="margin: 0; background: transparent"></body></html>'

// Shows a generated design in its own page, so the design's CSS can't restyle the app
const DesignFrame = ({ html, onResize }: Props) => {

    const frameRef = useRef<HTMLIFrameElement>(null)
    const [page, setPage] = useState<Document | null>(null)

    // Designs are styled with the app's Tailwind classes, so the page gets a copy of the app's stylesheets
    const handleLoad = () => {
        const doc = frameRef.current?.contentDocument
        if (!doc) return
        document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
            doc.head.appendChild(doc.importNode(node, true))
        })
        doc.body.className = document.body.className
        setPage(doc)
    }

    useEffect(() => {
        if (page) page.body.innerHTML = html
    }, [page, html])

    // Keeps the frame as tall as the design. It is measured with the frame collapsed,
    // so a design sized in viewport units can't keep growing its own frame.
    useEffect(() => {
        const frame = frameRef.current
        if (!page || !frame) return
        const observer = new ResizeObserver(() => {
            frame.style.height = '0px'
            const height = page.documentElement.scrollHeight
            frame.style.height = `${height}px`
            onResize(height)
        })
        observer.observe(page.documentElement)
        return () => observer.disconnect()
    }, [page, onResize])

    // inert and pointer-events-none keep clicks and keyboard focus out of the design,
    // so presses on it reach the canvas, which selects and drags the shape
    return (
        <iframe
            ref={frameRef}
            title='Generated design'
            sandbox='allow-same-origin'
            srcDoc={BLANK_PAGE}
            onLoad={handleLoad}
            inert
            className='block w-full h-0 border-0 pointer-events-none'
        />
    )
}

export default DesignFrame
