import { repairImageSrc } from "./image-src-repair"
import type { OutlineImageSlot } from "./wireframe-outline"

// The images a design may show, as short ids. The model only ever sees the ids (img-1, img-2…), the
// shape of each image, and which of the wireframe's image slots each one fills; it writes the id in
// an <img src>, and the server swaps in the image's real address as the design streams out. Any src
// that isn't one of these ids becomes a plain placeholder in the slot's shape, drawn inline, so a
// design never loads an address the model made up. Initial designs, refines and workflow pages all
// get the same manifest, so img-2 is the same picture in every one of them.

export const PLACEHOLDER_SRC = "placeholder"

export type ManifestImage = {
    id: string
    url: string
    width: number | null
    height: number | null
}

export type ManifestSlot = {
    id: string
    // The wireframe node the slot was drawn as
    node: string
    label?: string
    aspectRatio: number
    // The image that goes in it, or null for a placeholder
    image: string | null
}

export type ImageManifest = { images: ManifestImage[]; slots: ManifestSlot[] }

const ratio = (width: number | null, height: number | null) =>
    width && height ? Math.round((width / height) * 100) / 100 : null

// The images get ids in the order the user added them. The largest slot gets the first image (it's
// usually the hero), and the other slots the next ones in reading order; slots left over get a
// placeholder and images left over aren't placed, though the page may still use them.
export const buildImageManifest = (images: { url: string; width?: number | null; height?: number | null }[], slots: OutlineImageSlot[] = []): ImageManifest => {
    const manifestImages = images.map((image, index) => ({ id: `img-${index + 1}`, url: image.url, width: image.width ?? null, height: image.height ?? null }))
    const size = (slot: OutlineImageSlot) => (slot.box[2] - slot.box[0]) * (slot.box[3] - slot.box[1])
    const largest = slots.reduce<number>((best, slot, index) => (best === -1 || size(slot) > size(slots[best]) ? index : best), -1)
    const order = largest === -1 ? [] : [largest, ...slots.map((_, index) => index).filter((index) => index !== largest)]
    const assigned = new Map(order.map((slotIndex, position) => [slotIndex, manifestImages[position]?.id ?? null]))
    return {
        images: manifestImages,
        slots: slots.map((slot, index) => ({
            id: `slot-${index + 1}`,
            node: slot.node,
            ...(slot.label ? { label: slot.label } : {}),
            aspectRatio: slot.aspectRatio,
            image: assigned.get(index) ?? null,
        })),
    }
}

// What the prompt shows of the manifest: ids and shapes, never addresses
export const manifestForPrompt = (manifest: ImageManifest) => ({
    images: manifest.images.map((image) => {
        const aspect = ratio(image.width, image.height)
        return { id: image.id, aspectRatio: aspect, orientation: aspect === null ? "unknown" : aspect > 1.05 ? "landscape" : aspect < 0.95 ? "portrait" : "square" }
    }),
    slots: manifest.slots,
    placeholder: PLACEHOLDER_SRC,
})

// --- Placeholders -----------------------------------------------------------------------------

// A flat block in the design's muted color with a small picture sign, at the slot's shape. Still, and
// drawn inline, so it reads as a place for an image rather than a page that's still loading.
export const placeholderSrc = (aspectRatio: number, colors: { fill: string; ink: string }) => {
    const shape = Number.isFinite(aspectRatio) && aspectRatio > 0 ? Math.min(8, Math.max(0.125, aspectRatio)) : 4 / 3
    const width = 480
    const height = Math.round(width / shape)
    const unit = Math.min(width, height) / 6
    const [cx, cy] = [width / 2, height / 2]
    const round = (value: number) => Math.round(value * 10) / 10
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<rect width="${width}" height="${height}" fill="${colors.fill}"/>` +
        `<g fill="${colors.ink}" opacity="0.35">` +
        `<circle cx="${round(cx + unit * 0.55)}" cy="${round(cy - unit * 0.45)}" r="${round(unit * 0.28)}"/>` +
        `<path d="M${round(cx - unit)} ${round(cy + unit * 0.7)}L${round(cx - unit * 0.3)} ${round(cy - unit * 0.2)}L${round(cx + unit * 0.15)} ${round(cy + unit * 0.35)}L${round(cx + unit * 0.45)} ${round(cy + unit * 0.05)}L${round(cx + unit)} ${round(cy + unit * 0.7)}Z"/>` +
        `</g></svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// --- Reading and rewriting tags ---------------------------------------------------------------

type Attribute = { name: string; value: string | null }

const ATTRIBUTE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const decode = (value: string) =>
    value.replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&#x0*27;/gi, "'").replace(/&amp;/g, "&")

const encode = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")

const parseAttributes = (source: string): Attribute[] =>
    [...source.matchAll(ATTRIBUTE)].map((match) => ({
        name: match[1],
        value: match[2] ?? match[3] ?? match[4] ?? null,
    }))

const serialize = (name: string, attributes: Attribute[], selfClosing: boolean) =>
    `<${name}${attributes.map((attribute) => (attribute.value === null ? ` ${attribute.name}` : ` ${attribute.name}="${encode(decode(attribute.value))}"`)).join("")}${selfClosing ? " /" : ""}>`

// Where the tag starting at `start` ends (its ">"), skipping quoted attribute values, or -1
const tagEnd = (html: string, start: number) => {
    let quote: string | null = null
    for (let index = start + 1; index < html.length; index++) {
        const char = html[index]
        if (quote) {
            if (char === quote) quote = null
        } else if (char === '"' || char === "'") {
            quote = char
        } else if (char === ">") {
            return index
        }
    }
    return -1
}

type Context = {
    // id or address -> address, for everything a design may load
    approved: Map<string, string>
    slots: Map<string, ManifestSlot>
    placeholder: (aspectRatio: number) => string
}

// An image id as the model might write it: img-2, IMG-2, img2
const asImageId = (value: string) => {
    const match = /^img-?(\d+)$/i.exec(value.trim())
    return match ? `img-${Number(match[1])}` : null
}

const approvedUrl = (value: string, context: Context) => {
    const trimmed = value.trim()
    return context.approved.get(asImageId(trimmed) ?? trimmed) ?? null
}

// url(...) in CSS: ids and approved addresses become addresses; anything else, and every @import,
// goes, so a design's styles fetch nothing they weren't given
const sanitizeCss = (css: string, context: Context) =>
    decode(css)
        .replace(/@import\b[^;]*;?/gi, "")
        .replace(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi, (_, __, url: string) => {
            const approved = approvedUrl(url, context)
            return approved ? `url("${approved}")` : "none"
        })

// Elements that fetch what their attributes name, and the attributes that do it
const FETCHING: Record<string, string[]> = {
    source: ["src", "srcset"],
    video: ["src", "poster"],
    audio: ["src"],
    track: ["src"],
    iframe: ["src", "srcdoc"],
    embed: ["src"],
    object: ["data"],
    input: ["src"],
    image: ["href", "xlink:href"],
    use: ["href", "xlink:href"],
    feimage: ["href", "xlink:href"],
}
// Elements dropped outright: they load things or change where the page's addresses point
const DROPPED = new Set(["link", "base", "meta"])

const numberAttribute = (attributes: Attribute[], name: string) => {
    const value = Number.parseFloat(attributes.find((attribute) => attribute.name.toLowerCase() === name)?.value ?? "")
    return Number.isFinite(value) && value > 0 ? value : null
}

// One opening tag, made safe: its image resolved, and nothing else in it able to fetch
const rewriteTag = (tag: string, context: Context): string => {
    const match = /^<\s*([a-zA-Z][a-zA-Z0-9:-]*)([\s\S]*?)(\/?)\s*>$/.exec(tag)
    if (!match) return tag
    const [, name, rest, slash] = match
    const lower = name.toLowerCase()
    if (DROPPED.has(lower)) return ""
    let attributes = parseAttributes(rest)
    const fetching = new Set(FETCHING[lower] ?? [])
    attributes = attributes.filter((attribute) => {
        const attributeName = attribute.name.toLowerCase()
        if (attributeName === "background") return false
        if (!fetching.has(attributeName)) return true
        // A <use href="#icon"> points inside the page
        return (lower === "use" || lower === "image") && (attribute.value ?? "").trim().startsWith("#")
    })
    for (const attribute of attributes) {
        const attributeName = attribute.name.toLowerCase()
        if (attributeName === "style" && attribute.value !== null) attribute.value = sanitizeCss(attribute.value, context)
        // Links go nowhere outside the page, as the instructions say: a click would load the address
        // inside the design's frame
        if (attributeName === "href" && (lower === "a" || lower === "area") && !/^\s*(?:#|mailto:|tel:)/i.test(decode(attribute.value ?? ""))) attribute.value = "#"
    }

    if (lower === "img") {
        const src = attributes.find((attribute) => attribute.name.toLowerCase() === "src")
        const url = src?.value ? approvedUrl(decode(src.value), context) : null
        attributes = attributes.filter((attribute) => !["src", "srcset", "sizes", "data-placeholder"].includes(attribute.name.toLowerCase()))
        if (url) {
            attributes.unshift({ name: "src", value: url })
        } else {
            // In the slot's shape when the model said which slot, else the shape its width and height give
            const slotId = attributes.find((attribute) => attribute.name.toLowerCase() === "data-slot")?.value ?? ""
            const width = numberAttribute(attributes, "width")
            const height = numberAttribute(attributes, "height")
            const aspect = context.slots.get(slotId.trim())?.aspectRatio ?? (width && height ? width / height : 4 / 3)
            attributes.unshift({ name: "src", value: context.placeholder(aspect) }, { name: "data-placeholder", value: slotId.trim() || "true" })
        }
    }
    return serialize(name, attributes, slash === "/")
}

const contextFor = (manifest: ImageManifest, colors: { fill: string; ink: string }): Context => {
    const approved = new Map<string, string>()
    for (const image of manifest.images) {
        approved.set(image.id, image.url)
        approved.set(image.url, image.url)
    }
    return {
        approved,
        slots: new Map(manifest.slots.map((slot) => [slot.id, slot])),
        placeholder: (aspectRatio) => placeholderSrc(aspectRatio, colors),
    }
}

// Rewrites the complete tags in `html`, returning what's done and what's left for the next chunk:
// an unfinished tag, comment or <style> element waits until it's whole
const rewrite = (html: string, context: Context, final: boolean) => {
    let output = ""
    let index = 0
    while (index < html.length) {
        const open = html.indexOf("<", index)
        if (open === -1) {
            output += html.slice(index)
            index = html.length
            break
        }
        output += html.slice(index, open)
        const next = html[open + 1]
        if (next === undefined) {
            if (final) return { output, rest: "" }
            return { output, rest: html.slice(open) }
        }
        if (html.startsWith("<!--", open)) {
            const end = html.indexOf("-->", open + 4)
            if (end === -1) return final ? { output, rest: "" } : { output, rest: html.slice(open) }
            output += html.slice(open, end + 3)
            index = end + 3
            continue
        }
        if (!/[a-zA-Z\/!]/.test(next)) {
            output += "<"
            index = open + 1
            continue
        }
        const end = tagEnd(html, open)
        // An unfinished tag waits for the rest; at the very end it's dropped, as a browser would
        if (end === -1) return final ? { output, rest: "" } : { output, rest: html.slice(open) }
        const tag = html.slice(open, end + 1)
        // Scripts never run in a design's frame, so they're left out whole, contents and all
        if (/^<\s*script\b/i.test(tag)) {
            const close = html.slice(end + 1).search(/<\/\s*script\s*>/i)
            if (close === -1) return final ? { output, rest: "" } : { output, rest: html.slice(open) }
            const closeAt = end + 1 + close
            index = closeAt + /<\/\s*script\s*>/i.exec(html.slice(closeAt))![0].length
            continue
        }
        if (/^<\s*style\b/i.test(tag)) {
            const close = html.slice(end + 1).search(/<\/\s*style\s*>/i)
            if (close === -1) {
                if (!final) return { output, rest: html.slice(open) }
                output += `${rewriteTag(tag, context)}${sanitizeCss(html.slice(end + 1), context)}</style>`
                index = html.length
                break
            }
            const closeAt = end + 1 + close
            const closeTag = /<\/\s*style\s*>/i.exec(html.slice(closeAt))![0]
            output += `${rewriteTag(tag, context)}${sanitizeCss(html.slice(end + 1, closeAt), context)}${closeTag}`
            index = closeAt + closeTag.length
            continue
        }
        output += next === "/" || next === "!" ? tag : rewriteTag(tag, context)
        index = end + 1
    }
    return { output, rest: "" }
}

// The streamed design with its images resolved: ids become the images' addresses, anything else in
// an <img> becomes a placeholder, and nothing else in it can fetch. `colors` paints the placeholders.
export async function* resolveDesignImages(chunks: AsyncIterable<string>, manifest: ImageManifest, colors: { fill: string; ink: string }): AsyncGenerator<string> {
    const context = contextFor(manifest, colors)
    let pending = ""
    for await (const chunk of chunks) {
        const { output, rest } = rewrite(pending + chunk, context, false)
        pending = rest
        if (output) yield output
    }
    const { output } = rewrite(pending, context, true)
    if (output) yield output
}

// The same for a whole design at once
export const resolveDesignHtml = (html: string, manifest: ImageManifest, colors: { fill: string; ink: string }) =>
    rewrite(html, contextFor(manifest, colors), true).output

// A saved design as the model should see it when it's asked to change it or to build a workflow page
// from it: each image's address back to its id, and each placeholder back to "placeholder". Addresses
// from designs made before the manifest are matched too, typos and all.
export const designHtmlForPrompt = (html: string, manifest: ImageManifest) => {
    const urls = manifest.images.map((image) => image.url)
    const idOf = new Map(manifest.images.map((image) => [image.url, image.id]))
    const toId = (value: string) => {
        const repaired = repairImageSrc(decode(value).trim(), urls)
        return idOf.get(repaired) ?? null
    }
    return html
        .replace(/<img\b[^>]*>/gi, (tag) => {
            const isPlaceholder = /\sdata-placeholder\s*=/i.test(tag) || /\ssrc\s*=\s*["']data:image\/svg\+xml/i.test(tag)
            return tag.replace(/(\ssrc\s*=\s*)(["'])([\s\S]*?)\2/i, (whole, prefix: string, quote: string, value: string) => {
                if (isPlaceholder) return `${prefix}${quote}${PLACEHOLDER_SRC}${quote}`
                const id = toId(value)
                return id ? `${prefix}${quote}${id}${quote}` : whole
            })
        })
        // In a style attribute the quotes are written as &quot;
        .replace(/url\(\s*(&quot;|&#0*39;|["']?)([^"')]*?)\1\s*\)/gi, (whole, quote: string, url: string) => {
            const id = toId(url)
            return id ? `url(${quote}${id}${quote})` : whole
        })
}

// --- Loading the images -----------------------------------------------------------------------

// Width and height from the start of a PNG, JPEG, GIF or WebP file, or null
export const readImageSize = (bytes: Uint8Array): { width: number; height: number } | null => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const ascii = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length))
    if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(1, 3) === "PNG") {
        return { width: view.getUint32(16), height: view.getUint32(20) }
    }
    if (bytes.length >= 10 && ascii(0, 3) === "GIF") {
        return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
    }
    if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
        const chunk = ascii(12, 4)
        if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
        if (chunk === "VP8L") {
            const bits = view.getUint32(21, true)
            return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
        }
        if (chunk === "VP8X") {
            const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
            const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
            return { width, height }
        }
        return null
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let at = 2
        while (at + 9 < bytes.length) {
            if (bytes[at] !== 0xff) return null
            // 0xFF bytes can pad the space between segments
            if (bytes[at + 1] === 0xff) {
                at++
                continue
            }
            const marker = bytes[at + 1]
            const length = view.getUint16(at + 2)
            // Start-of-frame markers hold the size; C4, C8 and CC are other things
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) }
            }
            at += 2 + length
        }
    }
    return null
}

export type LoadedImage = { url: string; bytes: Uint8Array; mediaType?: string; width: number | null; height: number | null }

// Downloads the project's own images, the only addresses a design may use, to read their sizes and
// to hand the model the same bytes (the SDK would otherwise download each one again). One that can't
// be loaded is left out, as if it weren't there.
export const loadImages = async (urls: string[], fetchImpl: typeof fetch = fetch): Promise<LoadedImage[]> => {
    const loaded = await Promise.all(
        urls.map(async (url): Promise<LoadedImage | null> => {
            try {
                const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) })
                if (!response.ok) return null
                const bytes = new Uint8Array(await response.arrayBuffer())
                if (bytes.byteLength === 0 || bytes.byteLength > 20 * 1024 * 1024) return null
                const size = readImageSize(bytes)
                const mediaType = response.headers.get("content-type")?.split(";")[0].trim()
                return { url, bytes, ...(mediaType?.startsWith("image/") ? { mediaType } : {}), width: size?.width ?? null, height: size?.height ?? null }
            } catch (error) {
                console.warn(`Couldn't load project image ${url}:`, error)
                return null
            }
        })
    )
    return loaded.filter((image): image is LoadedImage => image !== null)
}
