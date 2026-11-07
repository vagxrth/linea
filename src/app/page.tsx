import type { Metadata } from "next"
import ClosingCta from "@/components/landing/closing-cta"
import Hero from "@/components/landing/hero"
import HowItWorks from "@/components/landing/how-it-works"
import Pricing from "@/components/landing/pricing"
import Proof from "@/components/landing/proof"
import { LandingMotion, Reveal } from "@/components/landing/reveal"
import SiteFooter from "@/components/landing/site-footer"
import SiteNav from "@/components/landing/site-nav"

export const metadata: Metadata = {
  title: "Linea: sketch a wireframe, get a designed page",
}

export default function Home() {
  return (
    <LandingMotion>
      {/* Sections fade in as they scroll into view. Without JavaScript nothing would show them, so they start visible. */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <div id="top">
        <SiteNav />
        <main data-landing>
          <Hero />

          <section aria-labelledby="proof-title" className="px-6 pt-8 pb-24 md:pb-32">
            <div className="mx-auto max-w-6xl">
              <Reveal className="max-w-2xl">
                <h2 id="proof-title" className="font-serif text-[clamp(2.3rem,4.6vw,3.6rem)] leading-[1.02] tracking-[-0.015em] text-balance">
                  From a rough sketch to a finished page
                </h2>
                <p className="mt-4 text-lg/relaxed text-pretty text-muted-foreground">
                  Draw boxes where things go and name them: navbar, hero image, card. Linea reads the layout
                  and builds a real page from it, in the colors and type of your style guide.
                </p>
              </Reveal>
              <Reveal className="mt-12 md:mt-16">
                <Proof />
              </Reveal>
            </div>
          </section>

          <HowItWorks />
          <Pricing />
          <ClosingCta />
        </main>
        <SiteFooter />
      </div>
    </LandingMotion>
  )
}
