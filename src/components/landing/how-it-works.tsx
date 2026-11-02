import { Reveal } from "./reveal"

const steps = [
    {
        title: "Sketch the layout",
        text: "Draw on an infinite canvas with shapes, arrows, lines, text and freehand. Put each page in a frame and label its parts. Every change saves on its own.",
    },
    {
        title: "Add a moodboard",
        text: "Upload a few reference images. Linea builds a style guide from them: a color palette, a type scale and spacing rules that every design follows.",
    },
    {
        title: "Generate the page",
        text: "Linea turns the frame into a complete, accessible HTML/CSS page in your style. Then make matching pages, like a dashboard, settings or a profile, in the same visual language.",
    },
    {
        title: "Refine and export",
        text: "Describe a change in plain words and the design updates in place. Download any design or frame as an image.",
    },
]

// The steps are a real sequence, so they're numbered, and strung on one line, the line Linea is named for
const HowItWorks = () => (
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

            <ol className="relative mt-14 grid gap-12 md:mt-20 md:grid-cols-4 md:gap-8">
                {/* The line through the steps: down the side on phones, across the top on wider screens */}
                <span aria-hidden className="absolute top-2 bottom-2 left-[0.6875rem] w-px bg-gradient-to-b from-brass/70 via-brass/30 to-transparent md:top-[0.6875rem] md:right-0 md:bottom-auto md:left-0 md:h-px md:w-auto md:bg-gradient-to-r" />
                {steps.map((step, index) => (
                    <li key={step.title} className="relative pl-10 md:pt-12 md:pl-0">
                        <Reveal delay={index * 0.08}>
                            <span aria-hidden className="absolute top-1 left-0 size-[1.375rem] rounded-full border border-brass/60 bg-background md:top-0 md:left-0">
                                <span className="absolute inset-[0.3125rem] rounded-full bg-brass" />
                            </span>
                            <p className="font-serif text-2xl leading-none text-brass">
                                <span className="sr-only">Step </span>{index + 1}
                            </p>
                            <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
                            <p className="mt-2 text-[0.9375rem]/relaxed text-pretty text-muted-foreground">{step.text}</p>
                        </Reveal>
                    </li>
                ))}
            </ol>
        </div>
    </section>
)

export default HowItWorks
