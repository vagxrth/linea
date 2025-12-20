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
                        <div className="grid items-stretch gap-12 divide-y p-12 pb-6 md:grid-cols-2 md:divide-x md:divide-y-0">
                            <div className="flex flex-col pb-12 text-center md:pb-0 md:pr-12">
                                <div>
                                    <h3 className="text-2xl font-semibold">Linea Premium</h3>
                                    <p className="mt-2 text-lg">Perfect for individuals and small teams</p>
                                </div>
                                <div className="flex flex-col items-center justify-center flex-1">
                                    <span className="mb-6 inline-block text-6xl font-bold">
                                        <span className="text-4xl">$</span>0.69
                                    </span>
                                    <Subscribe />
                                </div>
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
                                            title: 'Simple Credit System',
                                            description: 'Each AI design action consumes 1 credit. No hidden limits.'
                                        },
                                        {
                                            title: 'Pay as you go',
                                            description: 'Credits never expire. Buy only when you need them.'
                                        }
                                    ].map((item, index) => (
                                        <li
                                            key={index}
                                            className="flex items-start gap-3">
                                            <Check className="size-5 shrink-0 mt-0.5 text-green-500" />
                                            <div>
                                                <span className="font-medium">{item.title}</span>
                                                <p className="text-muted-foreground text-sm mt-0.5">{item.description}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <p className="text-muted-foreground text-center text-sm px-12 pb-8">
                            One-time payment. No auto-renewals. No lock-in.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Billing