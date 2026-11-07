import { getImageProps, type ImageLoaderProps } from "next/image"
import { preload } from "react-dom"

// Tailwind's md breakpoint: from here up the hero shows the canvas, below it the page alone
const WIDE = "(min-width: 48rem)"

// Each screenshot comes in a few widths, made from its original in public/images/landing. It's the
// largest paint on a phone's first screen, so it's served as plain files straight from the CDN rather
// than through the image optimizer, and arrives sooner. Each width the browser could ask for gets the
// smallest file at least as wide.
const sizedFiles = (name: string, widths: number[]) => ({ width }: ImageLoaderProps) => {
    const fit = widths.find((available) => available >= width)
    return `/images/landing/${fit ? `${name}-${fit}` : name}.webp`
}

const alt =
    "The homepage Linea generated from a hand-drawn wireframe for a plant shop, Veridian: a navbar, the headline “Bring Nature Indoors with Lush Plants”, a button and cards."

// Wider screens: Linea's canvas, the wireframe beside the page generated from it. The frame's width is
// the page's, less its side padding and the frame's own edge.
const { props: canvas } = getImageProps({
    loader: sizedFiles("generated", [640, 828, 1080, 1200]),
    src: "/images/landing/generated.webp",
    alt,
    width: 1920,
    height: 1200,
    sizes: "(min-width: 1200px) 1138px, calc(100vw - 3.875rem)",
})

// Phones: the generated page alone, cropped to its top, so its headline reads at a glance. The whole
// canvas at phone width shrinks it to a few pixels.
const { props: page } = getImageProps({
    loader: sizedFiles("generated-mobile", [640, 828]),
    src: "/images/landing/generated-mobile.webp",
    alt,
    width: 1200,
    height: 1500,
    sizes: "(min-width: 640px) calc(100vw - 3.875rem), calc(100vw - 2.875rem)",
    priority: true,
    fetchPriority: "high",
})

// The hero's screenshot. The browser picks one of the two pictures for the screen and fetches only
// that one, and each is preloaded only on its own screens, ahead of the page's scripts.
const HeroShot = () => {
    preload(canvas.src, { as: "image", imageSrcSet: canvas.srcSet, imageSizes: canvas.sizes, fetchPriority: "high", media: WIDE })
    preload(page.src, { as: "image", imageSrcSet: page.srcSet, imageSizes: page.sizes, fetchPriority: "high", media: `not all and ${WIDE}` })

    return (
        <picture>
            <source media={WIDE} srcSet={canvas.srcSet} sizes={canvas.sizes} width={canvas.width} height={canvas.height} />
            <img {...page} alt={alt} className="block aspect-[4/5] w-full md:aspect-[16/10]" />
        </picture>
    )
}

export default HeroShot
