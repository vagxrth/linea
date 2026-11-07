import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import {
    buildImageManifest,
    designHtmlForPrompt,
    loadImages,
    manifestForPrompt,
    placeholderSrc,
    readImageSize,
    resolveDesignHtml,
    resolveDesignImages,
} from "./image-manifest"

const urls = [
    "https://example.convex.cloud/api/storage/c659b302-ec94-4edf-b349-883756715fd2",
    "https://example.convex.cloud/api/storage/2c963b29-737d-4367-b27c-fe53c4aaee0e",
    "https://example.convex.cloud/api/storage/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
]
const colors = { fill: "#DCCFC2", ink: "#5C5557" }

// Slots in reading order: a small one at the top, the big hero image, and a third
const slots = [
    { node: "logo", aspectRatio: 1, box: [2, 2, 6, 6] as [number, number, number, number] },
    { node: "hero", label: "hero image", aspectRatio: 1.5, box: [50, 10, 96, 50] as [number, number, number, number] },
    { node: "card", aspectRatio: 0.8, box: [5, 60, 25, 90] as [number, number, number, number] },
]
const manifest = buildImageManifest([{ url: urls[0], width: 1200, height: 800 }, { url: urls[1], width: 800, height: 1000 }], slots)

const collect = async (stream: AsyncIterable<string>) => {
    let text = ""
    for await (const chunk of stream) text += chunk
    return text
}

async function* chunked(text: string, size: number) {
    for (let index = 0; index < text.length; index += size) yield text.slice(index, index + size)
}

describe("the manifest", () => {
    it("numbers the images in order and puts the first in the largest slot, the rest in reading order", () => {
        expect(manifest.images.map((image) => image.id)).toEqual(["img-1", "img-2"])
        expect(manifest.slots).toEqual([
            { id: "slot-1", node: "logo", aspectRatio: 1, image: "img-2" },
            { id: "slot-2", node: "hero", label: "hero image", aspectRatio: 1.5, image: "img-1" },
            // More slots than images: a placeholder
            { id: "slot-3", node: "card", aspectRatio: 0.8, image: null },
        ])
    })

    it("shows the model ids and shapes, never addresses", () => {
        const shown = manifestForPrompt(manifest)
        expect(JSON.stringify(shown)).not.toContain("https://")
        expect(shown.images).toEqual([
            { id: "img-1", aspectRatio: 1.5, orientation: "landscape" },
            { id: "img-2", aspectRatio: 0.8, orientation: "portrait" },
        ])
        expect(buildImageManifest([{ url: urls[2] }]).images[0]).toMatchObject({ id: "img-1", width: null, height: null })
        expect(manifestForPrompt(buildImageManifest([{ url: urls[2] }])).images[0].orientation).toBe("unknown")
    })
})

describe("resolving a design's images", () => {
    const design =
        `<div data-generated-ui><style>[data-generated-ui] .c-bg { background-color: #EADED3 } @import url("https://fonts.example/x.css"); .hero { background-image: url(img-2) } .bad { background: url('https://evil.example/a.png') }</style>` +
        `<link rel="stylesheet" href="https://evil.example/a.css"><script src="https://evil.example/a.js">fetch("x")</script>` +
        `<img src="img-1" data-slot="slot-2" alt="Hanging plant" class="h-full w-full object-cover">` +
        `<img src='IMG2' alt="Pots on a shelf" srcset="https://evil.example/a.png 2x">` +
        `<img src="placeholder" data-slot="slot-3" alt="Card picture">` +
        `<img src="https://images.unsplash.com/photo-1" width="300" height="100" alt="Made up">` +
        `<img alt="No src at all" />` +
        `<p style="background:url(https://evil.example/b.png) center/cover">Plain & simple text</p>` +
        `<video poster="https://evil.example/p.jpg" src="https://evil.example/v.mp4"></video><source srcset="https://evil.example/s.png">` +
        `<svg><use href="#leaf"></use><image href="https://evil.example/i.png"></image></svg>` +
        `<a href="#shop">Shop</a><a href="https://evil.example/page">Away</a><a href="mailto:hello@example.com">Mail</a></div>`

    it("swaps ids for the images' addresses and everything else for placeholders, and fetches nothing it wasn't given", async () => {
        const html = await collect(resolveDesignImages(chunked(design, 1000), manifest, colors))
        expect(html).toContain(`<img src="${urls[0]}" data-slot="slot-2" alt="Hanging plant" class="h-full w-full object-cover">`)
        expect(html).toContain(`<img src="${urls[1]}" alt="Pots on a shelf">`)
        // The placeholders keep their slot's shape, or the width and height they were given
        expect(html).toContain(`<img src="${placeholderSrc(0.8, colors)}" data-placeholder="slot-3" data-slot="slot-3" alt="Card picture">`)
        expect(html).toContain(`<img src="${placeholderSrc(3, colors)}" data-placeholder="true" width="300" height="100" alt="Made up">`)
        expect(html).toContain(`<img src="${placeholderSrc(4 / 3, colors)}" data-placeholder="true" alt="No src at all" />`)
        expect(html).toContain(`.hero { background-image: url("${urls[1]}") }`)
        expect(html).toContain(".bad { background: none }")
        expect(html).toContain('<p style="background:none center/cover">Plain & simple text</p>')
        expect(html).toContain('<use href="#leaf">')
        expect(html).toContain('<a href="#shop">Shop</a><a href="#">Away</a><a href="mailto:hello@example.com">Mail</a>')
        // The only addresses left are the project's own images
        expect([...html.matchAll(/https?:\/\/[^\s"')]+/g)].map((match) => match[0]).every((address) => urls.includes(address))).toBe(true)
        expect(html).not.toMatch(/<link|<script|@import|srcset|poster/)
    })

    it("comes out the same wherever the stream splits it", async () => {
        const whole = resolveDesignHtml(design, manifest, colors)
        for (const size of [1, 2, 3, 7, 50]) {
            expect(await collect(resolveDesignImages(chunked(design, size), manifest, colors))).toBe(whole)
        }
    })

    it("holds back a tag cut off at the end of the stream rather than sending half of it", async () => {
        const html = await collect(resolveDesignImages(chunked('<div><p>Done</p><img src="https://evil.exa', 4), manifest, colors))
        expect(html).toBe("<div><p>Done</p>")
    })

    it("draws placeholders as still, inline SVG in the design's muted colors", () => {
        const svg = decodeURIComponent(placeholderSrc(2, colors).replace("data:image/svg+xml,", ""))
        expect(svg).toContain('width="480" height="240"')
        expect(svg).toContain('fill="#DCCFC2"')
        expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/animate|https?:/)
    })
})

describe("a saved design for the prompt", () => {
    it("turns the images' addresses back into ids and placeholders back into 'placeholder'", () => {
        const saved = resolveDesignHtml('<img src="img-1" data-slot="slot-2" alt="a"><img src="placeholder" data-slot="slot-3" alt="b"><div style="background:url(img-2)"></div>', manifest, colors)
        expect(designHtmlForPrompt(saved, manifest)).toBe('<img src="img-1" data-slot="slot-2" alt="a"><img src="placeholder" data-placeholder="slot-3" data-slot="slot-3" alt="b"><div style="background:url(&quot;img-2&quot;)"></div>')
    })

    it("matches the addresses an older design mistyped, and leaves unknown ones for the resolver", () => {
        const older = `<img src="${urls[0].replace("715fd2", "71fd2")}" alt="a"><img src="https://images.unsplash.com/photo-1" alt="b">`
        expect(designHtmlForPrompt(older, manifest)).toBe('<img src="img-1" alt="a"><img src="https://images.unsplash.com/photo-1" alt="b">')
    })
})

describe("image sizes", () => {
    const bytes = (...values: number[]) => new Uint8Array(values)
    const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

    it("reads PNG, GIF, WebP and JPEG headers", () => {
        // PNG: width and height in the IHDR chunk
        expect(readImageSize(bytes(0x89, ...ascii("PNG"), 13, 10, 26, 10, 0, 0, 0, 13, ...ascii("IHDR"), 0, 0, 4, 176, 0, 0, 3, 32))).toEqual({ width: 1200, height: 800 })
        // GIF: little-endian at 6 and 8
        expect(readImageSize(bytes(...ascii("GIF89a"), 0x20, 0x03, 0x58, 0x02))).toEqual({ width: 800, height: 600 })
        // WebP with an extended header: 24-bit sizes less one
        expect(readImageSize(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8X"), 10, 0, 0, 0, 0, 0, 0, 0, 0x7f, 0x02, 0, 0xdf, 0x01, 0))).toEqual({ width: 640, height: 480 })
        // JPEG: an APP0 segment, padding, then the frame header
        expect(readImageSize(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xff, 0xc0, 0, 17, 8, 0x01, 0xe0, 0x02, 0x80, 3))).toEqual({ width: 640, height: 480 })
        expect(readImageSize(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toBeNull()
    })

    it("reads real files, as encoders write them", () => {
        const size = (file: string) => readImageSize(new Uint8Array(readFileSync(file)))
        // Lossy WebP with alpha (VP8X), and PNG
        expect(size("public/images/landing/generated-640.webp")).toEqual({ width: 640, height: 400 })
        expect(size("public/images/landing/generated-mobile.webp")).toEqual({ width: 1200, height: 1500 })
        expect(size("public/images/logo.webp")).toEqual({ width: 500, height: 500 })
        expect(size("src/app/apple-icon.png")).toEqual({ width: 180, height: 180 })
    })

    it("loads the project's images, reading their sizes and dropping any that fail", async () => {
        const png = bytes(0x89, ...ascii("PNG"), 13, 10, 26, 10, 0, 0, 0, 13, ...ascii("IHDR"), 0, 0, 0, 100, 0, 0, 0, 50)
        const fetcher = vi.fn(async (url: string | URL | Request) => {
            if (String(url) === urls[0]) return new Response(png, { headers: { "content-type": "image/png" } })
            if (String(url) === urls[1]) return new Response("missing", { status: 404 })
            throw new Error("network down")
        })
        vi.spyOn(console, "warn").mockImplementation(() => {})
        const images = await loadImages(urls, fetcher as typeof fetch)
        expect(images).toEqual([{ url: urls[0], bytes: png, mediaType: "image/png", width: 100, height: 50 }])
        expect(fetcher).toHaveBeenCalledTimes(3)
    })
})
