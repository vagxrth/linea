'use client'

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Logo from "./logo"

const sections = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
]

// Stays at the top of the landing page. It is clear over the hero, and gets a backdrop once the page
// scrolls, so the links stay readable over the sections below.
const SiteNav = () => {
    const sentinel = useRef<HTMLDivElement>(null)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const element = sentinel.current
        if (!element) return
        const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    return (
        <>
            {/* Leaves the viewport as soon as the page scrolls */}
            <div ref={sentinel} aria-hidden className="absolute inset-x-0 top-0 h-px" />
            <header
                data-scrolled={scrolled}
                className={cn(
                    "sticky top-0 z-50 border-b border-transparent transition-[background-color,border-color] duration-300",
                    "data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/90 data-[scrolled=true]:backdrop-blur-xl"
                )}
            >
                <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
                    <Logo href="/" className="mr-auto" />
                    {sections.map((section) => (
                        <Button key={section.href} asChild variant="ghost" size="sm" className="hidden text-muted-foreground hover:text-foreground md:inline-flex">
                            <Link href={section.href}>{section.label}</Link>
                        </Button>
                    ))}
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href="/auth/signin">Sign in</Link>
                    </Button>
                    <Button asChild size="sm" shape="pill" className="ml-1 px-4">
                        <Link href="/auth/signup">Get started</Link>
                    </Button>
                </nav>
            </header>
        </>
    )
}

export default SiteNav
