'use client'

import dynamic from "next/dynamic"
import { useReducedMotion } from "motion/react"
import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { ClearBox, KeepClear } from "./floating-pages"

// three.js is large, so it loads after the page, and only where the scene is shown
const FloatingPages = dynamic(() => import("./floating-pages"), { ssr: false })

// The scene is decoration: if WebGL fails, the hero goes on without it instead of showing an error
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() {
        return { failed: true }
    }
    render() {
        return this.state.failed ? null : this.props.children
    }
}

const canShowScene = () => {
    // Phones get the hero without it: there's no room beside the copy, and it costs battery
    if (!window.matchMedia("(min-width: 768px)").matches) return false
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (connection?.saveData) return false
    try {
        return !!document.createElement("canvas").getContext("webgl2")
    } catch {
        return false
    }
}

// The 3D backdrop behind the hero's copy. Put it inside the hero next to an element marked
// data-hero-copy: the pages float beside that element's children and fade out wherever they would
// pass behind one.
const HeroAtmosphere = () => {
    const area = useRef<HTMLDivElement>(null)
    const keepClear = useRef<KeepClear | null>(null)
    const [keepClearVersion, setKeepClearVersion] = useState(0)
    const [enabled, setEnabled] = useState(false)
    const [onScreen, setOnScreen] = useState(true)
    const [ready, setReady] = useState(false)
    const reducedMotion = useReducedMotion() ?? false

    useEffect(() => {
        const wide = window.matchMedia("(min-width: 768px)")
        const update = () => setEnabled(canShowScene())
        update()
        wide.addEventListener("change", update)
        return () => wide.removeEventListener("change", update)
    }, [])

    // The copy's pieces, in the scene's coordinates. They scroll with the scene, so they only move
    // when something resizes. The copy centers its children, so each one's box hugs its content.
    useEffect(() => {
        const element = area.current
        const copy = element?.parentElement?.querySelector("[data-hero-copy]")
        if (!element || !copy) return
        const measure = () => {
            const scene = element.getBoundingClientRect()
            if (!scene.width || !scene.height) return
            // A margin, so a page's edge doesn't graze the text
            const margin = 28
            const boxes: ClearBox[] = [...copy.children].map((child) => {
                const box = child.getBoundingClientRect()
                return {
                    left: ((box.left - margin - scene.left) / scene.width) * 2 - 1,
                    right: ((box.right + margin - scene.left) / scene.width) * 2 - 1,
                    top: 1 - ((box.top - margin - scene.top) / scene.height) * 2,
                    bottom: 1 - ((box.bottom + margin - scene.top) / scene.height) * 2,
                }
            })
            const reach = Math.max(0, ...boxes.map((box) => Math.max(-box.left, box.right)))
            keepClear.current = { boxes, reach }
            setKeepClearVersion((version) => version + 1)
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        observer.observe(copy)
        return () => observer.disconnect()
    }, [])

    // Stops the scene while the hero is scrolled away
    useEffect(() => {
        const element = area.current
        if (!element) return
        const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting))
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    const handleReady = useCallback(() => setReady(true), [])

    return (
        <div
            ref={area}
            aria-hidden
            // The first screen below the nav, whatever the hero holds below that, so pages keep their size
            // and pass behind the screenshot under the copy. Soft edges at the top and bottom, so pages
            // don't stop at a hard line.
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100svh-4rem)] [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_78%,transparent)]"
        >
            {enabled && (
                <div className={cn("absolute inset-0 transition-opacity duration-1000 ease-out", ready ? "opacity-100" : "opacity-0")}>
                    <SceneBoundary>
                        <Suspense fallback={null}>
                            <FloatingPages
                                keepClear={keepClear}
                                keepClearVersion={keepClearVersion}
                                reducedMotion={reducedMotion}
                                paused={!onScreen}
                                onReady={handleReady}
                            />
                        </Suspense>
                    </SceneBoundary>
                </div>
            )}
        </div>
    )
}

export default HeroAtmosphere
