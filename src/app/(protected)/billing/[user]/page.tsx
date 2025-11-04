import Subscribe from "@/components/buttons/subscribe"
import { Check } from "lucide-react"

const Billing = () => {
    return (
        <div className="relative py-16 md:py-32">
            <div className="mx-auto max-w-5xl px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-balance text-3xl font-bold md:text-4xl lg:text-5xl">
                        Upgrade to Linea Premium
                    </h2>
                </div>
                <div className="mt-8 md:mt-20">
                    <div className="bg-card relative rounded-3xl border shadow-2xl shadow-zinc-950/5">
                        <div className="grid items-center gap-12 divide-y p-12 md:grid-cols-2 md:divide-x md:divide-y-0">
                            <div className="pb-12 text-center md:pb-0 md:pr-12">
                                <h3 className="text-2xl font-semibold">Linea Premium</h3>
                                <p className="mt-2 text-lg">Perfect for individuals and small teams</p>
                                <span className="mb-6 mt-12 inline-block text-6xl font-bold">
                                    <span className="text-4xl">$</span>0.69
                                </span>
                                <div className="flex justify-center">
                                    <Subscribe />
                                </div>
                                <p className="text-muted-foreground mt-12 text-sm">
                                    Includes: Unlimited projects, 10 monthly credits, AI-powered design tools, and all features
                                </p>
                            </div>
                            <div className="relative">
                                <ul
                                    role="list"
                                    className="space-y-4">
                                    {[
                                        'AI-powered Design Creation - Transform sketches into designs',
                                        'Export your designs in high-quality formats',
                                        'Advanced AI Tools for complex design operations',
                                        '10 Monthly Credits for AI-powered design creation',
                                        'Simple Credit System - Each AI operation consumes 1 credit'
                                    ].map((item, index) => (
                                        <li
                                            key={index}
                                            className="flex items-start gap-3">
                                            <Check className="size-5 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-muted-foreground mt-6 text-sm">
                                    Get unlimited projects and access to all premium features. Cancel anytime with no hassle.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Billing