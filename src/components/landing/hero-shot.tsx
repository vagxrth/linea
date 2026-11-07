'use client'

import Image, { type ImageLoaderProps } from "next/image"

// The screenshot comes in these widths, made from the 1920px original (public/images/landing/
// generated.webp). Phones' first screen shows it in full, which makes it the page's largest paint
// there, so it's served as plain files straight from the CDN rather than through the image optimizer,
// and arrives sooner. Each width the browser could ask for gets the smallest file at least as wide.
const WIDTHS = [640, 828, 1080, 1200]

const loader = ({ width }: ImageLoaderProps) => {
    const fit = WIDTHS.find((available) => available >= width)
    return fit ? `/images/landing/generated-${fit}.webp` : "/images/landing/generated.webp"
}

// The hero's screenshot of Linea: a sketch and the page generated from it
const HeroShot = () => (
    <Image
        loader={loader}
        src="/images/landing/generated.webp"
        alt="Linea's canvas: a wireframe in a frame, with boxes labelled navbar, headline, button, hero image and card, beside the page Linea generated from it for a plant shop."
        width={1920}
        height={1200}
        // On phones this is the largest thing on the first screen, so it loads before anything else
        priority
        fetchPriority="high"
        // The frame's width: the page's, less its side padding and the frame's own edge
        sizes="(min-width: 1200px) 1138px, (min-width: 640px) calc(100vw - 3.875rem), calc(100vw - 2.875rem)"
        className="block aspect-[16/10] w-full"
    />
)

export default HeroShot
