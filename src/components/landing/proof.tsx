'use client'

import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react"
import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from "react"

// The artboard's own coordinates. Everything is drawn in one SVG, so the sketch and the page line up
// at any size.
const WIDTH = 1200
const HEIGHT = 760

// The page's style guide: the colors a moodboard of plants and paper might give
const BONE = "#F3F0E8"
const PINE = "#1F2D24"
const MOSS = "#3E6B4E"
const SAGE = "#DCE6D5"
const SWATCHES = [BONE, MOSS, PINE]

// The seam curves the way the one in the logo does: one gentle S from top to bottom
const seamPath = (x: number) => `M${x},0 C${x + 22},${HEIGHT * 0.25} ${x - 22},${HEIGHT * 0.75} ${x},${HEIGHT}`
// The generated page shows left of the seam, the sketch right of it
const pageSide = (x: number) => `M0,0 L${x},0 C${x + 22},${HEIGHT * 0.25} ${x - 22},${HEIGHT * 0.75} ${x},${HEIGHT} L0,${HEIGHT} Z`
const sketchSide = (x: number) => `M${x},0 C${x + 22},${HEIGHT * 0.25} ${x - 22},${HEIGHT * 0.75} ${x},${HEIGHT} L${WIDTH},${HEIGHT} L${WIDTH},0 Z`

// The same "random" numbers on the server and in the browser, so the drawing hydrates cleanly
const noise = (seed: number, i: number) => {
    const value = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
    return value - Math.floor(value)
}

// A pen's stand-in for a line of text: a quick wave from x1 to x2 whose bumps vary the way a hand's do
const scribble = (x1: number, x2: number, y: number, seed: number) => {
    let d = `M${x1},${y}`
    for (let x = x1, i = 0; x < x2; i++) {
        const r = noise(seed, i)
        const next = Math.min(x + 8 + r * 7, x2)
        const height = 4 + r * 4
        d += ` Q${((x + next) / 2).toFixed(1)},${(y + (i % 2 ? height : -height)).toFixed(1)} ${next.toFixed(1)},${(y + (r - 0.5) * 2).toFixed(1)}`
        x = next
    }
    return d
}

// A leaf from its base, pointing `angle` degrees up from the right
const leaf = (x: number, y: number, angle: number, length: number, width: number) => {
    const rad = (angle * Math.PI) / 180
    const tipX = x + Math.cos(rad) * length
    const tipY = y - Math.sin(rad) * length
    const midX = (x + tipX) / 2
    const midY = (y + tipY) / 2
    const nx = Math.sin(rad) * width
    const ny = Math.cos(rad) * width
    return `M${x},${y} Q${midX + nx},${midY + ny} ${tipX},${tipY} Q${midX - nx},${midY - ny} ${x},${y} Z`
}

const CARDS = [
    { x: 112, title: "Low light", text: "Happy a room away from the window." },
    { x: 448, title: "Pet safe", text: "Fine around curious cats and dogs." },
    { x: 784, title: "Easy care", text: "Water it every other week or so." },
]

// What a frame looks like on Linea's canvas: white shapes, and labels naming each part
const Sketch = () => (
    <g fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x={112} y={114} width={976} height={58} rx={8} />
        <circle cx={146} cy={143} r={13} />
        <path d="M770,143 H806 M832,143 H868 M894,143 H930" />
        <rect x={962} y={128} width={100} height={30} rx={15} />

        <path d={scribble(112, 520, 238, 1)} strokeWidth={3} />
        <path d={scribble(112, 450, 290, 2)} strokeWidth={3} />
        <path d="M112,338 H492 M112,362 H462 M112,386 H372" strokeOpacity={0.7} />
        <rect x={112} y={420} width={164} height={46} rx={23} />

        <rect x={600} y={206} width={488} height={262} rx={8} />
        <path d="M600,206 L1088,468 M1088,206 L600,468" strokeOpacity={0.45} />

        {CARDS.map((card) => (
            <g key={card.x}>
                <rect x={card.x} y={506} width={304} height={160} rx={8} />
                <circle cx={card.x + 34} cy={540} r={14} />
                <path d={`M${card.x + 24},592 H${card.x + 244} M${card.x + 24},616 H${card.x + 194}`} strokeOpacity={0.7} />
            </g>
        ))}

        <g fill="white" stroke="none" className="font-sans" fontSize={15}>
            <text x={172} y={148}>navbar</text>
            <text x={194} y={448} textAnchor="middle">button</text>
            <rect x={790} y={322} width={108} height={30} rx={6} className="fill-background" />
            <text x={844} y={342} textAnchor="middle">hero image</text>
            {CARDS.map((card) => (
                <text key={card.x} x={card.x + 60} y={545}>card</text>
            ))}
        </g>
    </g>
)

// The page Linea builds from that frame: the same layout, styled
const Page = () => (
    <g className="font-sans">
        <rect x={80} y={84} width={1040} height={612} rx={14} fill={BONE} />

        <circle cx={146} cy={143} r={13} fill={MOSS} />
        <path d={leaf(140, 150, 55, 15, 4)} fill={BONE} />
        <text x={170} y={152} className="font-serif" fontSize={30} fill={PINE}>Fernery</text>
        <g fontSize={15} fill={PINE} fillOpacity={0.72}>
            <text x={770} y={148}>Plants</text>
            <text x={832} y={148}>Care</text>
            <text x={894} y={148}>Visit</text>
        </g>
        <rect x={962} y={128} width={100} height={30} rx={15} fill={PINE} />
        <text x={1012} y={148} textAnchor="middle" fontSize={13} fontWeight={500} fill={BONE}>Shop now</text>
        <path d="M112,186 H1088" stroke={PINE} strokeOpacity={0.08} />

        <g className="font-serif" fontSize={60} fill={PINE}>
            <text x={110} y={256}>Plants for</text>
            <text x={110} y={310}>slow mornings</text>
        </g>
        <g fontSize={17} fill={PINE} fillOpacity={0.68}>
            <text x={112} y={352}>Hardy houseplants, potted by hand</text>
            <text x={112} y={376}>and delivered with a care card</text>
            <text x={112} y={400}>for every single one.</text>
        </g>
        <rect x={112} y={420} width={164} height={46} rx={23} fill={MOSS} />
        <text x={194} y={449} textAnchor="middle" fontSize={16} fontWeight={500} fill="white">Shop plants</text>

        <defs>
            <linearGradient id="proof-photo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={SAGE} />
                <stop offset="1" stopColor="#B7CBB0" />
            </linearGradient>
        </defs>
        <rect x={600} y={206} width={488} height={262} rx={18} fill="url(#proof-photo)" />
        <circle cx={1016} cy={262} r={34} fill="#F2E8CB" />
        <g>
            <path d={leaf(844, 404, 92, 150, 30)} fill={MOSS} />
            <path d={leaf(844, 404, 125, 118, 32)} fill="#2F5640" />
            <path d={leaf(844, 404, 58, 122, 32)} fill="#2F5640" />
            <path d={leaf(844, 404, 152, 92, 24)} fill={MOSS} />
            <path d={leaf(844, 404, 30, 94, 24)} fill={MOSS} />
        </g>
        <rect x={800} y={398} width={88} height={10} rx={3} fill="#CDB594" />
        <path d="M806,408 L882,408 L873,458 L815,458 Z" fill="#D9C4A6" />

        {CARDS.map((card) => (
            <g key={card.x}>
                <rect x={card.x} y={506} width={304} height={160} rx={16} fill="white" stroke={PINE} strokeOpacity={0.08} />
                <circle cx={card.x + 34} cy={540} r={16} fill={SAGE} />
                <circle cx={card.x + 34} cy={540} r={5} fill={MOSS} />
                <text x={card.x + 24} y={596} fontSize={18} fontWeight={600} fill={PINE}>{card.title}</text>
                <text x={card.x + 24} y={622} fontSize={14} fill={PINE} fillOpacity={0.62}>{card.text}</text>
            </g>
        ))}
    </g>
)

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
                className="relative aspect-[1200/760] w-full cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-2xl border bg-background bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px]"
            >
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    className="absolute inset-0 size-full"
                    role="img"
                    aria-label="A plant shop page generated by Linea, beside the wireframe it came from: boxes on Linea's canvas labelled navbar, hero image, button and card."
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

                    {/* The frame, as the canvas shows it */}
                    <text x={80} y={70} className="font-sans" fontSize={14} fill="white" fillOpacity={0.75}>Frame 1</text>
                    <rect x={80} y={84} width={1040} height={612} rx={14} fill="white" fillOpacity={0.05} stroke="white" strokeOpacity={0.14} />

                    <g clipPath={`url(#${ids}-sketch)`}>
                        <Sketch />
                    </g>
                    <g clipPath={`url(#${ids}-page)`}>
                        <Page />
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
                <span className="flex items-center gap-3">
                    Linea output, in your style guide&apos;s colors
                    <span className="flex items-center gap-1.5" aria-hidden>
                        {SWATCHES.map((color) => (
                            <span key={color} className="size-3.5 rounded-full border border-white/15" style={{ backgroundColor: color }} />
                        ))}
                    </span>
                </span>
                <span className="hidden [@media(hover:hover)]:inline">Drag the line to compare</span>
                <span>Your sketch, on the canvas</span>
            </figcaption>
        </figure>
    )
}

export default Proof
