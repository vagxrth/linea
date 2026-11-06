import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Download, Maximize2 } from "lucide-react"
import Logo from "@/components/landing/logo"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Linea pitch deck",
  description: "Linea's pitch deck: the problem, the product, the market and the business model, in 11 slides.",
}

const DECK = "/pitch.pdf"

// The pitch deck in Linea's own chrome: a light bar with the way back to the site, the title in
// Instrument Serif, and the PDF in a frame. Phones mostly can't show a PDF inside a page, so there the
// frame shows the deck's cover (public/pitch-cover.webp, its first slide), which opens the PDF.
export default function PitchPage() {
  return (
    <div data-app-chrome className="flex min-h-svh flex-col">
      {/* A light bar, like billing's, with the page's colors swapped */}
      <header className="bg-foreground text-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo className="focus-visible:ring-background/50" />
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-background/80 outline-none transition-colors hover:bg-background/10 hover:text-background focus-visible:ring-[3px] focus-visible:ring-background/50 [&_svg]:size-4"
          >
            <ArrowLeft aria-hidden />
            Back to Linea
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h1 className="font-serif text-4xl tracking-tight text-balance md:text-5xl">Pitch deck</h1>
            <p className="mt-3 text-[0.9375rem]/relaxed text-pretty text-muted-foreground">
              The problem Linea solves, how it works, the market and the business model, in 11 slides.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" shape="pill">
              <a href={DECK} target="_blank" rel="noopener">
                <Maximize2 />
                Open full screen
              </a>
            </Button>
            <Button asChild shape="pill">
              <a href={DECK} download="linea-pitch-deck.pdf">
                <Download />
                Download PDF
              </a>
            </Button>
          </div>
        </div>

        {/* The slides are 16:9, and so is the frame: the viewer's toolbar is hidden, so a slide fills it
            and scrolling moves to the next one. The cover in its place is the same shape. */}
        <div className="mt-8 overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/40">
          <object data={`${DECK}#toolbar=0&view=FitH`} type="application/pdf" aria-label="Linea pitch deck" className="block aspect-video w-full">
            <a href={DECK} target="_blank" rel="noopener" className="group relative block outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Image
                src="/pitch-cover.webp"
                alt="The deck's cover: Linea, from napkin doodles to digital masterpieces"
                width={1600}
                height={900}
                priority
                className="aspect-video w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-5 pt-10 pb-4 text-sm font-medium text-white">
                Open all 11 slides
                <Maximize2 aria-hidden className="size-4 opacity-80 transition-opacity group-hover:opacity-100" />
              </span>
            </a>
          </object>
        </div>
      </main>
    </div>
  )
}
