import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Reveal } from "./reveal"

// The plans as the README lists them. Prices live in Polar and credits in convex/subscription.ts,
// so a change there needs one here too.
const plans = [
    {
        name: "Free",
        price: "$0",
        cadence: null,
        summary: "10 credits to try Linea.",
        points: ["Every feature, from the canvas to export", "10 credits once you confirm your email", "No card needed"],
        cta: "Start free",
        featured: false,
    },
    {
        name: "Pro",
        price: "$15",
        cadence: "a month",
        summary: "Or $120 a year, a third off.",
        points: ["100 credits every month", "Billed monthly or yearly", "Switch plans or cancel anytime from Manage plan"],
        cta: "Get started",
        featured: true,
    },
]

const Pricing = () => (
    <section id="pricing" className="scroll-mt-16 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
                <h2 className="font-serif text-[clamp(2.3rem,4.6vw,3.6rem)] leading-[1.02] tracking-[-0.015em] text-balance">
                    Pricing
                </h2>
                <p className="mt-4 text-lg/relaxed text-pretty text-muted-foreground">
                    Start with free credits. Subscribe from the app when you need more.
                </p>
            </Reveal>

            <div className="mt-14 grid gap-6 md:mt-16 md:grid-cols-2">
                {plans.map((plan, index) => (
                    <Reveal key={plan.name} delay={index * 0.08} className="h-full">
                        <div
                            className={cn(
                                "relative flex h-full flex-col rounded-3xl border p-8 md:p-10",
                                plan.featured && "bg-card"
                            )}
                        >
                            {/* Pro carries the line: a brass rule across its top edge */}
                            {plan.featured && (
                                <span aria-hidden className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-brass to-transparent" />
                            )}
                            <h3 className="text-lg font-medium">{plan.name}</h3>
                            <p className="mt-6 flex items-baseline gap-2">
                                <span className="font-serif text-6xl leading-none tracking-tight">{plan.price}</span>
                                {plan.cadence && <span className="text-muted-foreground">{plan.cadence}</span>}
                            </p>
                            <p className="mt-3 text-muted-foreground">{plan.summary}</p>
                            <ul className="mt-8 flex flex-col gap-3 text-[0.9375rem]">
                                {plan.points.map((point) => (
                                    <li key={point} className="flex gap-3">
                                        <Check aria-hidden className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-brass" : "text-muted-foreground")} />
                                        {point}
                                    </li>
                                ))}
                            </ul>
                            <Button asChild size="lg" shape="pill" variant={plan.featured ? "default" : "glass"} className="mt-10 self-start">
                                <Link href="/auth/signup">{plan.cta}</Link>
                            </Button>
                        </div>
                    </Reveal>
                ))}
            </div>

            <Reveal className="mt-10 max-w-3xl">
                <p className="text-sm/relaxed text-pretty text-muted-foreground">
                    A generated or redesigned page uses 1 credit, a style guide uses 1, and a 4-page workflow uses 4.
                    Generations that fail cost nothing. To go Pro, sign up and subscribe from the app.
                </p>
            </Reveal>
        </div>
    </section>
)

export default Pricing
