import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import HeroAtmosphere from "./hero-atmosphere"
import WindowFrame from "./window-frame"

// The promise from the README and the way in, over a screenshot of Linea showing exactly that: a sketch
// and the page generated from it. The screenshot needs no JavaScript or WebGL, so every screen gets
// it. On wider screens, more screenshots float up both sides behind it.
const Hero = () => (
    <section className="relative isolate overflow-hidden">
        <HeroAtmosphere />
        <div data-hero-copy className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-10 text-center sm:pt-14">
            <h1 className="flex flex-col items-center font-serif text-[clamp(2.5rem,6vw,5.1rem)] leading-[1] tracking-[-0.02em] text-balance">
                <span>Sketch a wireframe.</span>
                <span>Get a designed page.</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg/relaxed text-pretty text-muted-foreground md:mt-6">
                Linea is an AI design tool that turns hand-drawn wireframes into HTML/CSS pages, styled from your
                moodboard.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:mt-8">
                <Button asChild size="xl" shape="pill">
                    <Link href="/auth/signup">Try Linea free</Link>
                </Button>
                <Button asChild size="xl" shape="pill" variant="glass">
                    <Link href="#how-it-works">See how it works</Link>
                </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">10 free credits to start. No card needed.</p>
        </div>

        {/* Close enough under the buttons that its top shows on the first screen, phones included */}
        <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 md:pt-12 md:pb-20">
            <WindowFrame>
                <Image
                    src="/images/landing/generated.webp"
                    alt="Linea's canvas: a wireframe in a frame, with boxes labelled navbar, headline, button, hero image and card, beside the page Linea generated from it for a plant shop."
                    width={1920}
                    height={1200}
                    // On phones this is the largest thing on the first screen, so it loads before anything else
                    priority
                    fetchPriority="high"
                    // The frame's width: the page's, less its side padding and the frame's own edge
                    sizes="(min-width: 1200px) 1138px, (min-width: 640px) calc(100vw - 3.875rem), calc(100vw - 2.875rem)"
                    className="block aspect-[16/10] w-full"
                />
            </WindowFrame>
        </div>
    </section>
)

export default Hero
