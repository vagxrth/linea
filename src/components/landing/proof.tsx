'use client'

import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react"
import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from "react"

// Two screenshots from a demo project in Linea, taken at the same spot on the canvas at 100% zoom: a
// frame with a wireframe, and the page Linea generated from it. The artboard uses their size, in CSS
// pixels, as its coordinates, so the seam and both images line up at any width.
const WIDTH = 980
const HEIGHT = 620
const SKETCH = "/images/proof-sketch.webp"
const GENERATED = "/images/proof-generated.webp"

// The seam curves the way the one in the logo does: one gentle S from top to bottom
const seamPath = (x: number) => `M${x},0 C${x + 22},${HEIGHT * 0.25} ${x - 22},${HEIGHT * 0.75} ${x},${HEIGHT}`
// The generated page shows left of the seam, the sketch right of it
const pageSide = (x: number) => `M0,0 L${x},0 C${x + 22},${HEIGHT * 0.25} ${x - 22},${HEIGHT * 0.75} ${x},${HEIGHT} L0,${HEIGHT} Z`
const sketchSide = (x: number) => `M${x},0 C${x + 22},${HEIGHT * 0.25} ${x - 22},${HEIGHT * 0.75} ${x},${HEIGHT} L${WIDTH},${HEIGHT} L${WIDTH},0 Z`

// Where the seam settles: far enough right to show the generated headline beside the sketch
const RESTING = WIDTH * 0.56

const Proof = () => {
    const artboard = useRef<HTMLDivElement>(null)
    const handle = useRef<HTMLButtonElement>(null)
    const sweep = useRef<AnimationPlaybackControls | null>(null)
    const dragging = useRef(false)
    const ids = useId().replace(/[^a-zA-Z0-9-]/g, "")
    const reducedMotion = useReducedMotion()
    const inView = useInView(artboard, { once: true, amount: 0.5 })

    // Where the seam is, in artboard units. It starts at the left edge, all sketch.
    const seam = useMotionValue(0)
    const seamD = useTransform(seam, seamPath)
    const sketchD = useTransform(seam, sketchSide)
    const pageD = useTransform(seam, pageSide)
    // The handle follows the seam but stays whole at either end of the frame
    const handleLeft = useTransform(seam, (x) => `clamp(1.375rem, ${(x / WIDTH) * 100}%, calc(100% - 1.375rem))`)

    // The handle tells assistive tech how much of the generated page shows
    useMotionValueEvent(seam, "change", (x) => {
        const percent = Math.round((x / WIDTH) * 100)
        handle.current?.setAttribute("aria-valuenow", String(percent))
        handle.current?.setAttribute("aria-valuetext", `${percent}% generated page, ${100 - percent}% sketch`)
    })

    // The page's one orchestrated moment: when the frame comes into view, the line sweeps across the
    // sketch and leaves the generated page behind it, then eases back to the middle to compare the two.
    // With reduced motion, both halves simply show.
    useEffect(() => {
        if (reducedMotion) {
            seam.set(RESTING)
            return
        }
        if (!inView || dragging.current) return
        sweep.current = animate(seam, [0, WIDTH * 0.95, RESTING], {
            duration: 2.8,
            delay: 0.25,
            times: [0, 0.62, 1],
            ease: [[0.65, 0, 0.35, 1], [0.65, 0, 0.35, 1]],
        })
        return () => sweep.current?.stop()
    }, [inView, reducedMotion, seam])

    const moveTo = (x: number) => {
        sweep.current?.stop()
        seam.set(Math.min(WIDTH, Math.max(0, x)))
    }

    const moveToPointer = (event: PointerEvent<HTMLDivElement>) => {
        const box = event.currentTarget.getBoundingClientRect()
        moveTo(((event.clientX - box.left) / box.width) * WIDTH)
    }

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        moveToPointer(event)
    }

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (dragging.current) moveToPointer(event)
    }

    const stopDragging = () => {
        dragging.current = false
    }

    // Keys move the seam at once: an animation on every press would only slow it down
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const step = WIDTH * (event.key === "PageUp" || event.key === "PageDown" ? 0.1 : 0.04)
        const moves: Record<string, number> = {
            ArrowLeft: seam.get() - step,
            ArrowDown: seam.get() - step,
            PageDown: seam.get() - step,
            ArrowRight: seam.get() + step,
            ArrowUp: seam.get() + step,
            PageUp: seam.get() + step,
            Home: 0,
            End: WIDTH,
        }
        if (!(event.key in moves)) return
        event.preventDefault()
        moveTo(moves[event.key])
    }

    return (
        <figure className="flex flex-col gap-4">
            <div
                ref={artboard}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
                // Vertical swipes still scroll the page on touch screens
                className="relative aspect-[980/620] w-full cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-2xl border bg-background"
            >
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    className="absolute inset-0 size-full"
                    role="img"
                    aria-label="Screenshots from a demo project in Linea: a page Linea generated, beside the wireframe on the canvas it was generated from, with boxes labelled navbar, headline, button, hero image and card."
                >
                    <defs>
                        <clipPath id={`${ids}-sketch`}>
                            <motion.path d={sketchD} />
                        </clipPath>
                        <clipPath id={`${ids}-page`}>
                            <motion.path d={pageD} />
                        </clipPath>
                        <filter id={`${ids}-glow`} x="-50%" y="-10%" width="200%" height="120%">
                            <feGaussianBlur stdDeviation="6" />
                        </filter>
                    </defs>

                    <g clipPath={`url(#${ids}-sketch)`}>
                        <image href={SKETCH} width={WIDTH} height={HEIGHT} preserveAspectRatio="xMidYMid slice" />
                    </g>
                    <g clipPath={`url(#${ids}-page)`}>
                        <image href={GENERATED} width={WIDTH} height={HEIGHT} preserveAspectRatio="xMidYMid slice" />
                    </g>

                    <motion.path d={seamD} fill="none" className="stroke-brass" strokeWidth={10} strokeOpacity={0.35} filter={`url(#${ids}-glow)`} />
                    <motion.path d={seamD} fill="none" className="stroke-brass" strokeWidth={2.5} />
                </svg>

                <motion.button
                    ref={handle}
                    type="button"
                    role="slider"
                    aria-label="Compare the sketch with the generated page"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={0}
                    aria-valuetext="0% generated page, 100% sketch"
                    aria-orientation="horizontal"
                    onKeyDown={onKeyDown}
                    style={{ left: handleLeft }}
                    className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-brass/70 bg-background/90 text-brass shadow-lg shadow-black/40 outline-none backdrop-blur focus-visible:ring-[3px] focus-visible:ring-brass/50"
                >
                    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                        <path d="M7.5 5.5 L3.5 10 L7.5 14.5 M12.5 5.5 L16.5 10 L12.5 14.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </motion.button>
            </div>

            <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span>Demo — real Linea generation</span>
                <span className="hidden [@media(hover:hover)]:inline">Drag the line to compare</span>
                <span>Your sketch, on the canvas</span>
            </figcaption>
        </figure>
    )
}

export default Proof
