import { describe, expect, it } from "vitest"
import { googleFontHref, inlineUrls, isWebFont, loadWebFonts, primaryFamily } from "./web-fonts"

// Just enough of a document for loadWebFonts: a head that remembers its links
const fakeDocument = () => {
    const links: { rel: string; href: string; crossOrigin: string }[] = []
    return {
        links,
        createElement: () => ({ rel: "", href: "", crossOrigin: "" }),
        head: {
            querySelector: (selector: string) => links.find((link) => selector === `link[href="${link.href}"]`) ?? null,
            appendChild: (link: { rel: string; href: string; crossOrigin: string }) => {
                links.push(link)
                return link
            },
        },
    }
}

describe("primaryFamily", () => {
    it("takes the first family, without quotes", () => {
        expect(primaryFamily("Lato, sans-serif")).toBe("Lato")
        expect(primaryFamily("'Playfair Display', Georgia, serif")).toBe("Playfair Display")
        expect(primaryFamily('"Open Sans"')).toBe("Open Sans")
        expect(primaryFamily("")).toBe("")
        expect(primaryFamily(undefined)).toBe("")
    })
})

describe("isWebFont", () => {
    it("fetches named fonts but not generic, system or app fonts", () => {
        expect(isWebFont("Lato")).toBe(true)
        expect(isWebFont("Playfair Display")).toBe(true)
        for (const family of ["sans-serif", "system-ui", "ui-sans-serif", "Arial", "Helvetica Neue", "Georgia", "Geist", "Instrument Serif", "-apple-system", "__Geist_5e1e2b", "", "x"]) {
            expect(isWebFont(family)).toBe(false)
        }
    })
})

describe("googleFontHref", () => {
    it("asks Google for one family with every weight", () => {
        expect(googleFontHref("Playfair Display")).toBe(
            "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@100;200;300;400;500;600;700;800;900&display=swap"
        )
    })
})

describe("loadWebFonts", () => {
    it("adds one stylesheet per web font, once", () => {
        const doc = fakeDocument()
        const values = ["Lato, sans-serif", "'Playfair Display', serif", "Lato", "Geist, 'Geist Fallback'", "ui-sans-serif, system-ui"]

        expect(loadWebFonts(doc as unknown as Document, values)).toEqual(["Lato", "Playfair Display"])
        expect(loadWebFonts(doc as unknown as Document, values)).toEqual([])
        expect(doc.links).toEqual([
            { rel: "stylesheet", href: googleFontHref("Lato"), crossOrigin: "anonymous" },
            { rel: "stylesheet", href: googleFontHref("Playfair Display"), crossOrigin: "anonymous" },
        ])
    })
})

describe("inlineUrls", () => {
    it("swaps every font file URL for its data, fetching each file once", async () => {
        const css = `@font-face { font-family: 'Lato'; src: url(https://fonts.gstatic.com/a.woff2) format('woff2'); }
@font-face { font-family: 'Lato'; src: url("https://fonts.gstatic.com/b.woff2") format('woff2'), url(https://fonts.gstatic.com/a.woff2); }`
        const fetched: string[] = []
        const inlined = await inlineUrls(css, async (url) => {
            fetched.push(url)
            return `data:font/woff2;base64,${url.slice(-7, -6)}`
        })

        expect(fetched).toEqual(["https://fonts.gstatic.com/a.woff2", "https://fonts.gstatic.com/b.woff2"])
        expect(inlined).not.toContain("https://")
        expect(inlined).toContain("url(data:font/woff2;base64,a)")
        expect(inlined).toContain('url("data:font/woff2;base64,b")')
    })
})
