'use client'

import Image from "next/image"
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react"
import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Reveal } from "./reveal"
import WindowFrame from "./window-frame"

// The steps, each with a screenshot of it from the demo project
const steps = [
    {
        title: "Sketch the layout",
        text: "Draw on an infinite canvas, put the page in a frame and label its parts: navbar, hero image, card.",
        image: "/images/landing/step-canvas.webp",
        alt: "A wireframe on Linea's canvas: a frame with boxes labelled navbar, headline, button, hero image and card.",
    },
    {
        title: "Add a moodboard",
        text: "Upload a few reference images. Linea builds a style guide your designs draw from: colors, type and spacing.",
        image: "/images/landing/step-style-guide.webp",
        alt: "The colors of the style guide Linea built from a moodboard of plant illustrations, each with its hex value and role.",
    },
    {
        title: "Generate the page",
        text: "Linea turns the frame into a full HTML/CSS page in your style.",
        image: "/images/landing/step-generated.webp",
        alt: "The page Linea generated from the wireframe: a plant shop's homepage with a navbar, headline, button, hero illustration and cards.",
    },
    {
        title: "Refine and export",
        text: "Describe a change and the design updates in place. Download any design or frame as an image.",
        image: "/images/landing/step-chat.webp",
        alt: "Linea's chat beside the page, asked to move the cards up under the hero and make the main button sage green, after it regenerated the design.",
    },
]

// How far either side of the line between two steps the next screenshot takes to fade in, as a share
// of the list's scroll
const FADE = 0.05

type ShotProps = {
    index: number
    progress: MotionValue<number>
    active: number
    reducedMotion: boolean
}

// One step's screenshot in the sticky frame. Each lies over the one before and fades in on top of it,
// so the frame never shows the background halfway through a fade.
const Shot = ({ index, progress, active, reducedMotion }: ShotProps) => {
    const start = index / steps.length
    const fadeIn = useTransform(progress, [start - FADE, start + FADE], [0, 1])
    // With reduced motion, the screenshot changes at once when the step does
    const opacity = index === 0 ? 1 : reducedMotion ? (index <= active ? 1 : 0) : fadeIn
    const step = steps[index]

    return (
        <motion.div className="absolute inset-0" style={{ opacity }}>
            <Image src={step.image} alt={step.alt} fill sizes="(min-width: 1200px) 640px, (min-width: 1024px) 56vw, 46vw" className="object-cover" />
        </motion.div>
    )
}

// On wider screens the steps scroll past a screenshot that stays put and changes with them. On phones
// each step simply has its screenshot under it.
const HowItWorks = () => {
    const list = useRef<HTMLOListElement>(null)
    const reducedMotion = useReducedMotion() ?? false
    const [active, setActive] = useState(0)
    // 0 as the list's top passes the middle of the screen and 1 as its bottom does: a quarter per step
    const { scrollYProgress } = useScroll({ target: list, offset: ["start center", "end center"] })

    useMotionValueEvent(scrollYProgress, "change", (progress) => {
        setActive(Math.min(steps.length - 1, Math.max(0, Math.floor(progress * steps.length))))
    })

    return (
        <section id="how-it-works" className="scroll-mt-16 px-6 py-24 md:py-32">
            <div className="mx-auto max-w-6xl">
                <Reveal className="max-w-2xl">
                    <h2 className="font-serif text-[clamp(2.3rem,4.6vw,3.6rem)] leading-[1.02] tracking-[-0.015em] text-balance">
                        How it works
                    </h2>
                    <p className="mt-4 text-lg/relaxed text-pretty text-muted-foreground">
                        Four steps from an idea on the canvas to a page you can hand off.
                    </p>
                </Reveal>

                <div className="mt-14 md:mt-12 md:grid md:grid-cols-2 md:gap-x-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-20">
                    <ol ref={list} className="relative flex flex-col gap-16 md:gap-0">
                        {steps.map((step, index) => (
                            // Each step gets a stretch of scrolling, with its text in the middle of it
                            <li key={step.title} className="md:flex md:min-h-[min(28rem,55svh)] md:items-center">
                                <div className="relative md:pl-8">
                                    {/* The step on screen carries the brass rule */}
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "absolute inset-y-1 left-0 hidden w-0.5 rounded-full transition-colors duration-300 motion-reduce:transition-none md:block",
                                            index === active ? "bg-brass" : "bg-white/10"
                                        )}
                                    />
                                    <p className="font-serif text-3xl leading-none text-brass">
                                        <span className="sr-only">Step </span>{index + 1}
                                    </p>
                                    <h3 className="mt-3 text-xl font-medium">{step.title}</h3>
                                    <p className="mt-2 max-w-md text-base/relaxed text-pretty text-muted-foreground">{step.text}</p>
                                    <WindowFrame className="mt-6 md:hidden">
                                        <Image
                                            src={step.image}
                                            alt={step.alt}
                                            width={1600}
                                            height={1000}
                                            sizes="calc(100vw - 3.875rem)"
                                            className="block aspect-[16/10] w-full"
                                        />
                                    </WindowFrame>
                                </div>
                            </li>
                        ))}
                    </ol>

                    {/* Stays in the middle of the screen while the steps pass */}
                    <div className="hidden md:block">
                        <div className="sticky top-[max(5rem,calc(50svh-13.5rem))]">
                            <WindowFrame>
                                <div className="relative aspect-[16/10]">
                                    {steps.map((step, index) => (
                                        <Shot key={step.title} index={index} progress={scrollYProgress} active={active} reducedMotion={reducedMotion} />
                                    ))}
                                </div>
                            </WindowFrame>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HowItWorks
