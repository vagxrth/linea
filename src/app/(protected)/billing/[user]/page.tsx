import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import PlanPrice from "@/components/billing/plan-price"
import Logo from "@/components/landing/logo"
import { planProductIds } from "@/lib/plans"

type Props = {
    // The signed-in user's name, as in /dashboard/[slug]
    params: Promise<{ user: string }>
}

const Billing = async ({ params }: Props) => {
    const { user } = await params
    const dashboard = `/dashboard/${user}`
    // The yearly plan is offered only when its Polar product is set up
    const hasYearly = planProductIds().length > 1

    return (
        <div className="relative">
            {/* A light bar across the top, so the way back to the app reads as app chrome, apart from
                the dark card. Its colors are the page's, swapped. */}
            <header className="bg-foreground text-background">
                <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
                    <Logo href={dashboard} className="focus-visible:ring-background/50" />
                    <Link
                        href={dashboard}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-background/80 outline-none transition-colors hover:bg-background/10 hover:text-background focus-visible:ring-[3px] focus-visible:ring-background/50 [&_svg]:size-4"
                    >
                        <ArrowLeft aria-hidden />
                        Back to dashboard
                    </Link>
                </div>
            </header>
            <div className="mx-auto max-w-5xl px-6 pt-10 pb-16 md:pt-20 md:pb-32">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-balance font-serif text-4xl tracking-tight md:text-5xl lg:text-6xl">
                        Upgrade to Linea Pro
                    </h2>
                </div>
                <div className="mt-8 md:mt-20">
                    <div className="bg-card relative rounded-3xl border shadow-2xl shadow-zinc-950/5">
                        <div className="grid items-stretch gap-12 divide-y p-12 pb-6 md:grid-cols-2 md:divide-x md:divide-y-0">
                            <div className="flex flex-col pb-12 text-center md:pb-0 md:pr-12">
                                <div>
                                    <h3 className="font-serif text-3xl">Linea Pro</h3>
                                    <p className="mt-2 text-lg text-muted-foreground">Perfect for individuals and small teams</p>
                                </div>
                                <PlanPrice hasYearly={hasYearly} />
                            </div>
                            <div className="relative">
                                <ul
                                    role="list"
                                    className="space-y-5">
                                    {[
                                        {
                                            title: 'AI-powered Design Creation',
                                            description: 'Turn sketches and wireframes into polished, production-ready designs using AI.'
                                        },
                                        {
                                            title: 'High-Quality Exports',
                                            description: 'Export designs in high-resolution formats ready for sharing, handoff, or production.'
                                        },
                                        {
                                            title: '100 Credits per Month',
                                            description: 'A design, style guide or redesign uses 1 credit, and a 4-page workflow uses 4.'
                                        },
                                        ...(hasYearly ? [{
                                            title: 'Monthly or Yearly',
                                            description: 'Credits refill every month on both plans. No manual top-ups needed.'
                                        }] : [])
                                    ].map((item, index) => (
                                        <li
                                            key={index}
                                            className="flex items-start gap-3">
                                            <Check className="size-5 shrink-0 mt-0.5 text-brass" />
                                            <div>
                                                <span className="font-medium">{item.title}</span>
                                                <p className="text-muted-foreground text-[0.9375rem]/relaxed mt-0.5">{item.description}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <p className="text-muted-foreground text-center text-sm px-12 pb-8">
                            {hasYearly ? 'Billed monthly or yearly. Cancel anytime.' : 'Billed monthly. Cancel anytime.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Billing