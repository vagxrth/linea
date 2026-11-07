import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Reveal } from "./reveal"

// The way in again, last thing before the footer, under a brass hairline
const ClosingCta = () => (
    <section aria-labelledby="closing-title" className="px-6 pb-24 md:pb-32">
        <div className="relative mx-auto max-w-6xl pt-20 md:pt-24">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/70 to-transparent" />
            <Reveal className="flex flex-col items-center text-center">
                <h2 id="closing-title" className="font-serif text-[clamp(2.4rem,5.2vw,4.2rem)] leading-[1] tracking-[-0.02em]">
                    Start with a sketch.
                </h2>
                <Button asChild size="xl" shape="pill" className="mt-9">
                    <Link href="/auth/signup">Try Linea free</Link>
                </Button>
                <p className="mt-4 text-sm text-muted-foreground">10 free credits. No card needed.</p>
            </Reveal>
        </div>
    </section>
)

export default ClosingCta
