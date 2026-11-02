// Style guides name fonts like Lato or Playfair Display, and generated designs use them, but nothing
// loaded them, so the style guide's type preview and the designs fell back to the browser's own
// fonts. These load each one from Google Fonts, where the style guide's fonts come from.

// Families that need no download: CSS's generic names, fonts that ship with the common systems, and
// the app's own fonts (next/font loads those)
const LOCAL_FAMILIES = new Set([
    "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif",
    "ui-monospace", "ui-rounded", "emoji", "math", "fangsong",
    "arial", "helvetica", "helvetica neue", "times", "times new roman", "georgia", "verdana", "tahoma",
    "trebuchet ms", "courier", "courier new", "segoe ui", "menlo", "monaco", "consolas",
    "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji",
    "geist", "geist mono", "geist fallback", "geist mono fallback", "instrument serif",
])

// The family a font-family value asks for first, without quotes: "'Playfair Display', serif" gives
// Playfair Display. The browser only falls back past it when it's missing.
export const primaryFamily = (fontFamily: string | null | undefined) =>
    (fontFamily ?? "").split(",")[0].trim().replace(/^["']|["']$/g, "").trim()

// Whether a family is one to fetch: Google Fonts names are letters, digits and spaces
export const isWebFont = (family: string) =>
    /^[A-Za-z0-9 ]{2,64}$/.test(family) && !LOCAL_FAMILIES.has(family.toLowerCase())

// One family's stylesheet, asking for every weight: Google returns the ones the family has. Each
// family gets its own stylesheet, because Google rejects a request that names a family it doesn't
// have, and would take the others in that request down with it.
export const googleFontHref = (family: string) =>
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@100;200;300;400;500;600;700;800;900&display=swap`

// Swaps each url(...) in a stylesheet's text for what toDataUrl returns for it, so the text needs
// nothing from the network
export const inlineUrls = async (cssText: string, toDataUrl: (url: string) => Promise<string>) => {
    const urls = [...new Set([...cssText.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1]))]
    const data = await Promise.all(urls.map(toDataUrl))
    return urls.reduce((text, url, i) => text.split(url).join(data[i]), cssText)
}

const fileAsDataUrl = async (url: string) => {
    const blob = await (await fetch(url)).blob()
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
    })
}

// The @font-face rules of the web fonts loaded into a document, with their font files inlined, for a
// design's export to carry. html-to-image can't work these out itself for a design: it decides which
// fonts are in use by walking the elements, and stops at elements from another frame's document.
export const webFontEmbedCSS = async (doc: Document) => {
    const rules = [...doc.styleSheets]
        .filter((sheet) => sheet.href?.startsWith("https://fonts.googleapis.com/"))
        .flatMap((sheet) => {
            try {
                return [...sheet.cssRules].filter((rule) => rule.cssText.startsWith("@font-face"))
            } catch {
                // Loaded without CORS, so its rules can't be read
                return []
            }
        })
    const css = await Promise.all(rules.map((rule) => inlineUrls(rule.cssText, fileAsDataUrl).catch(() => "")))
    return css.join("\n")
}

// The part of a document this needs, so it works on a design's frame as well as the page
type FontDocument = Pick<Document, "createElement"> & { head: Pick<HTMLHeadElement, "querySelector" | "appendChild"> }

// Adds a stylesheet for each web font among the font-family values that the document doesn't load
// yet. display=swap shows the fallback until the font arrives, so nothing waits on Google.
export const loadWebFonts = (doc: FontDocument, fontFamilies: Iterable<string | null | undefined>) => {
    const added: string[] = []
    for (const value of fontFamilies) {
        const family = primaryFamily(value)
        if (!isWebFont(family)) continue
        const href = googleFontHref(family)
        if (doc.head.querySelector(`link[href="${href}"]`)) continue
        const link = doc.createElement("link")
        link.rel = "stylesheet"
        // Google serves these with CORS, and asking for it lets a design's export read the fonts'
        // rules to embed them
        link.crossOrigin = "anonymous"
        link.href = href
        doc.head.appendChild(link)
        added.push(family)
    }
    return added
}
