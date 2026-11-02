import Link from "next/link"
import { Button } from "@/components/ui/button"
import HeroAtmosphere from "./hero-atmosphere"

// The promise from the README, with the way in. Pages of Linea output float up on either side of it.
const Hero = () => (
    // Fills the first screen from tablets up. Phones have no scene beside the copy, so it sits near the top.
    <section className="relative isolate flex items-center overflow-hidden md:min-h-[calc(100svh-4rem)]">
        <HeroAtmosphere />
        <div data-hero-copy className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-16 pb-20 text-center md:pt-10 md:pb-24">
            <h1 className="flex flex-col items-center font-serif text-[clamp(2.6rem,6vw,5.1rem)] leading-[1] tracking-[-0.02em] text-balance">
                <span>Sketch a wireframe.</span>
                <span>Get a <span className="whitespace-nowrap">production-ready</span> design.</span>
            </h1>
            <p className="mt-7 max-w-[36rem] text-lg/relaxed text-pretty text-muted-foreground">
                Linea is an AI design tool that turns hand-drawn wireframes into polished HTML/CSS pages,
                styled by a design system it builds from your moodboard.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="xl" shape="pill">
                    <Link href="/auth/signup">Try Linea free</Link>
                </Button>
                <Button asChild size="xl" shape="pill" variant="glass">
                    <Link href="#how-it-works">See how it works</Link>
                </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">10 free credits to start. No card needed.</p>
        </div>
    </section>
)

export default Hero
