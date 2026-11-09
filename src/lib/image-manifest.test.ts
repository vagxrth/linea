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

describe("an image that couldn't be loaded", () => {
    const bytes = new Uint8Array([1, 2, 3])
    // The project's three images, with the second one failing this time
    const partial = buildImageManifest(
        [{ url: urls[0], width: 1200, height: 800, bytes }, { url: urls[1], width: null, height: null, bytes: null }, { url: urls[2], width: 800, height: 1000, bytes }],
        slots
    )

    it("keeps its id and its place, so the ids after it stay the same, and isn't put in a slot", () => {
        expect(partial.images.map((image) => [image.id, image.url, image.loaded])).toEqual([["img-1", urls[0], true], ["img-2", urls[1], false], ["img-3", urls[2], true]])
        expect(partial.slots.map((slot) => slot.image)).toEqual(["img-3", "img-1", null])
        expect(manifestForPrompt(partial).images[1]).toEqual({ id: "img-2", loaded: false })
    })

    it("keeps img-3 as img-3 in both an initial design and a refine, and shows the placeholder for img-2", () => {
        // Initial: the model writes the ids it was given
        const initial = resolveDesignHtml('<img src="img-3" alt="c"><img src="img-2" data-slot="slot-3" alt="b"><div style="background-image:url(img-2)"></div>', partial, colors)
        expect(initial).toContain(`<img src="${urls[2]}" alt="c">`)
        expect(initial).toContain(`<img src="${placeholderSrc(0.8, colors)}" data-placeholder="slot-3" data-slot="slot-3" alt="b">`)
        expect(initial).toContain(`style="background-image:url(&quot;${placeholderSrc(4 / 3, colors)}&quot;)"`)
        expect(initial).not.toContain(urls[1])
        // Refine: a design saved when every image loaded comes back to the model with the same ids
        const saved = `<img src="${urls[0]}" alt="a"><img src="${urls[1]}" alt="b"><img src="${urls[2]}" alt="c"><div style="background:url(&quot;${urls[2]}&quot;)"></div>`
        const forPrompt = designHtmlForPrompt(saved, partial)
        expect(forPrompt).toBe('<img src="img-1" alt="a"><img src="img-2" alt="b"><img src="img-3" alt="c"><div style="background:url(&quot;img-3&quot;)"></div>')
        const refined = resolveDesignHtml(forPrompt, partial, colors)
        expect(refined).toContain(`<img src="${urls[0]}" alt="a">`)
        expect(refined).toContain(`<img src="${placeholderSrc(4 / 3, colors)}" data-placeholder="true" alt="b">`)
        expect(refined).toContain(`<img src="${urls[2]}" alt="c">`)
        expect(refined).toContain(`url(&quot;${urls[2]}&quot;)`)
        // A placeholder drawn in CSS goes back to the model as url(placeholder), and comes out drawn again
        expect(designHtmlForPrompt(initial, partial)).toContain('style="background-image:url(&quot;placeholder&quot;)"')
        expect(resolveDesignHtml(designHtmlForPrompt(initial, partial), partial, colors)).toBe(initial)
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

describe("CSS and SVG that try to fetch another way", () => {
    const resolve = (html: string) => resolveDesignHtml(html, manifest, colors)
    const external = (html: string) => [...html.matchAll(/https?:\/\/[^\s"')&]+/g)].map((match) => match[0]).filter((address) => !urls.includes(address))

    it("takes out CSS escapes before looking for url(), so u\\72l() can't spell one", () => {
        const html = resolve(
            `<style>.a { background: u\\72l(https://evil.example/a.png) } .b { background: \\75 rl("https://evil.example/b.png") } .c { background: u\\rl(https://evil.example/c.png) }</style>` +
            `<p style="background:u\\72l(https://evil.example/d.png)">x</p>`
        )
        // Hex escapes go entirely, leaving a function no browser knows; any other escape loses its
        // backslash, which spells url( for the url() rule to catch
        expect(html).toBe(
            `<style>.a { background: ul(https://evil.example/a.png) } .b { background: rl("https://evil.example/b.png") } .c { background: none }</style>` +
            `<p style="background:ul(https://evil.example/d.png)">x</p>`
        )
        expect(html).not.toMatch(/url\(\s*["']?https?:/i)
    })

    it("turns image-set() into none, with or without -webkit-, however its arguments are written", () => {
        const html = resolve(
            `<style>.a { background-image: image-set("https://evil.example/a.png" 1x, url(img-1) 2x) } .b { background-image: -webkit-image-set(url("https://evil.example/b.png") 1x) } ` +
            `.c { background-image: image-set("https://evil.example/c).png" type("image/png") 1x) } .d { color: red }</style>` +
            `<div style="background-image:IMAGE-SET('https://evil.example/d.png' 1x)"></div>`
        )
        expect(html).toContain("<style>.a { background-image: none } .b { background-image: none } .c { background-image: none } .d { color: red }</style>")
        expect(html).toContain('<div style="background-image:none"></div>')
        expect(external(html)).toEqual([])
    })

    it("finds url() however it's quoted or hidden, and @import however it's rebuilt", () => {
        const html = resolve(
            `<style>.a { background: url("https://evil.example/a)b.png") } .b { background: url('https://evil.example/it"s.png') } ` +
            `.c { background: u/**/rl(https://evil.example/c.png) } @imp@import "x.css";ort "https://evil.example/d.css"; .e { color: red }</style>`
        )
        expect(external(html)).toEqual([])
        expect(html).not.toMatch(/@import/i)
        expect(html).toContain(".e { color: red }")
    })

    it("treats xlink:href like href: links go to #, and SVG references only point inside the page", () => {
        const html = resolve(
            `<svg><a xlink:href="https://evil.example/page"><text>Away</text></a><a xlink:href="#top"><text>Top</text></a>` +
            `<image xlink:href="https://evil.example/i.png"></image><use xlink:href="#leaf"></use>` +
            `<linearGradient id="fade" href="https://evil.example/g.svg#g"></linearGradient><pattern id="dots" xlink:href="#base"></pattern>` +
            `<rect fill="url(#fade)" stroke="url(https://evil.example/s.svg#p)" filter="url('https://evil.example/f.svg#f')"></rect></svg>`
        )
        expect(html).toContain('<a xlink:href="#"><text>Away</text></a><a xlink:href="#top">')
        expect(html).toContain("<image></image>")
        expect(html).toContain('<use xlink:href="#leaf">')
        expect(html).toContain('<linearGradient id="fade">')
        expect(html).toContain('<pattern id="dots" xlink:href="#base">')
        expect(html).toContain('<rect fill="url(&quot;#fade&quot;)" stroke="none" filter="none">')
        expect(external(html)).toEqual([])
    })

    it("drops what can fetch later or elsewhere: SVG animation of an href, pings, xml:base and MathML glyphs", () => {
        const html = resolve(
            `<svg xml:base="https://evil.example/"><image><set attributeName="href" to="https://evil.example/x.png"/></image>` +
            `<a href="#"><animate attributeName="xlink:href" values="https://evil.example/y"/></a></svg>` +
            `<a href="#shop" ping="https://evil.example/ping">Shop</a><math><mglyph src="https://evil.example/g.png" alt="g"></mglyph></math>`
        )
        expect(html).toBe('<svg><image></image><a href="#"></a></svg><a href="#shop">Shop</a><math><mglyph alt="g"></mglyph></math>')
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

    it("loads the project's images, reading their sizes, and keeps any that fail in their place with no bytes", async () => {
        const png = bytes(0x89, ...ascii("PNG"), 13, 10, 26, 10, 0, 0, 0, 13, ...ascii("IHDR"), 0, 0, 0, 100, 0, 0, 0, 50)
        const fetcher = vi.fn(async (url: string | URL | Request) => {
            if (String(url) === urls[0]) return new Response(png, { headers: { "content-type": "image/png" } })
            if (String(url) === urls[1]) return new Response("missing", { status: 404 })
            throw new Error("network down")
        })
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        const images = await loadImages(urls, fetcher as typeof fetch)
        expect(images).toEqual([
            { url: urls[0], bytes: png, mediaType: "image/png", width: 100, height: 50 },
            { url: urls[1], bytes: null, width: null, height: null },
            { url: urls[2], bytes: null, width: null, height: null },
        ])
        expect(fetcher).toHaveBeenCalledTimes(3)
        expect(warn).toHaveBeenCalledWith(`Couldn't load project image ${urls[1]}:`, "HTTP 404")
        expect(buildImageManifest(images).images.map((image) => [image.id, image.loaded])).toEqual([["img-1", true], ["img-2", false], ["img-3", false]])
    })
})
