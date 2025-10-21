import Subscribe from "@/components/buttons/subscribe"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Code, Download, Palette, Sparkles, Zap } from "lucide-react"

const Billing = () => {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-primary to-primary/60 rounded-full mb-4 shadow-lg">
                        <Sparkles className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-3">
                        Upgrade to Pro
                    </h1>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                        Get access to all features and unlimited projects
                    </p>
                </div>
                <Card className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] shadow-xl saturate-150">
                    <CardHeader className="text-center pb-4">
                        <div className="flex items-center justify-center mb-3">
                            <Badge variant='secondary' className="bg-primary/20 text-primary border-primary/20 px-3 py-1 text-xs font-medium rounded-full">
                                Premium
                            </Badge>
                        </div>
                        <CardTitle className="text-2xl font-bold text-foreground mb-2">Linea Premium</CardTitle>
                        <div className="flex items-baseline justify-center gap-2">
                            <span className="text-4xl font-bold text-foreground">$0.69</span>
                            <span className="text-sm text-muted-foreground">/month</span>
                        </div>
                        <CardDescription className="text-muted-foreground text-sm mt-2">
                            Get 10 Credits per month
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6">
                        <div className="text-center">
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Perfect for individuals and small teams
                            </p>
                            <p className="text-muted-foreground text-sm leading-relaxed mt-2">
                                Unlimited projects
                            </p>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-base font-semibold text-foreground text-center mb-3">
                                What&apos;s included
                            </h3>
                            <div className="grid gap-2">
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                                    <div className="w-6 h-6 bg-primary/20 rounded-md flex items-center justify-center flex-shrink-0">
                                        <Palette className="w-3 h-3 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-foreground font-medium text-sm">
                                            AI-powered Design Creation
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            Transform sketches into designs
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                                    <div className="w-6 h-6 bg-primary/20 rounded-md flex items-center justify-center flex-shrink-0">
                                        <Download className="w-3 h-3 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-foreground font-medium text-sm">
                                            Export your designs
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            High-quality exports in multiple formats
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                                    <div className="w-6 h-6 bg-primary/20 rounded-md flex items-center justify-center flex-shrink-0">
                                        <Code className="w-3 h-3 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-foreground font-medium text-sm">
                                            Advanced AI Tools
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            Access to advanced AI tools and complex design operations
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                                    <div className="w-6 h-6 bg-primary/20 rounded-md flex items-center justify-center flex-shrink-0">
                                        <Zap className="w-3 h-3 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-foreground font-medium text-sm">
                                            10 Monthly Credits
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            Credits can be used for AI-powered design creation
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-foreground font-medium text-sm mb-1">
                                                Simple Credit System
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                Each AI operation consumes 1 credit
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 pt-4 px-6 pb-6">
                        <Subscribe />
                        <p className="text-muted-foreground text-xs text-center">
                            Cancel Anytime
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}

export default Billing