import Link from "next/link"
import Logo from "./logo"

const links = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "Sign in", href: "/auth/signin" },
    { label: "Get started", href: "/auth/signup" },
]

const help = [
    { label: "hey@vagarth.in", href: "mailto:hey@vagarth.in" },
    { label: "Report an issue", href: "https://github.com/vagxrth/linea/issues" },
]

const SiteFooter = () => (
    <footer className="border-t px-6 pt-16 pb-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 md:flex-row md:justify-between">
            <div className="flex flex-col gap-3">
                <Logo href="#top" className="self-start" />
                <p className="text-sm text-muted-foreground">Think. Sketch. Design.</p>
            </div>
            <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm sm:flex sm:gap-24">
                <nav aria-label="Footer" className="flex flex-col gap-3">
                    {links.map((link) => (
                        <Link key={link.href} href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                            {link.label}
                        </Link>
                    ))}
                </nav>
                <div className="flex flex-col gap-3">
                    <p className="text-foreground">Help</p>
                    {help.map((link) => (
                        <a key={link.href} href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                            {link.label}
                        </a>
                    ))}
                </div>
            </div>
        </div>
        <p className="mx-auto mt-16 max-w-6xl text-xs text-muted-foreground">
            © 2025–2026 Vagarth Pandey. All rights reserved.
        </p>
    </footer>
)

export default SiteFooter
