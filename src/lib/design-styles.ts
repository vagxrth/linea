import { FRAME_BACKDROP, FRAME_TEXT, colorsIn, over, parseColor, tailwindColor, type Rgba } from "./design-colors"
import { ROOT, type HtmlElement } from "./html-tree"

// The styles a design's elements get in its frame, worked out the way the browser does for what
// design checks need: text color, the surface behind it, font size and weight, opacity, whether it's
// shown, and the declared sizes of images. A design's own <style> block is unlayered CSS, so it beats
// the Tailwind classes, which the frame compiles into a layer; inline styles beat both. Rules inside
// a media query apply when the query holds at the frame's width, and :hover-style states never do.

export type Declaration = { property: string; value: string; important: boolean }

// --- Selectors ---------------------------------------------------------------------------------

type Simple =
    | { type: "universal" }
    | { type: "tag" | "id" | "class"; name: string }
    | { type: "attribute"; name: string; operator: string | null; value: string; insensitive: boolean }
    | { type: "position"; name: string; argument: string | null }
    | { type: "logical"; name: "not" | "is" | "where"; list: Compound[] }
    | { type: "never" }

type Compound = Simple[]

type Combinator = " " | ">" | "+" | "~"

export type Selector = { compounds: Compound[]; combinators: Combinator[] }

// States a static page is never in, and pseudo-elements, which style something other than the element
const NEVER = new Set([
    "hover", "focus", "focus-visible", "focus-within", "active", "visited", "target", "checked", "indeterminate", "invalid",
    "user-invalid", "placeholder-shown", "autofill", "open", "popover-open", "modal", "fullscreen", "playing", "paused",
    "before", "after", "first-line", "first-letter", "placeholder", "selection", "marker", "backdrop", "file-selector-button",
])

const POSITIONAL = new Set(["root", "first-child", "last-child", "only-child", "nth-child", "nth-last-child", "first-of-type", "last-of-type", "nth-of-type", "empty", "disabled", "enabled", "required", "optional", "link", "any-link"])

// Splits on `separator` outside quotes, brackets and parentheses
export const splitOutside = (text: string, separator: string) => {
    const parts: string[] = []
    let depth = 0
    let quote: string | null = null
    let start = 0
    for (let at = 0; at < text.length; at++) {
        const char = text[at]
        if (quote) {
            if (char === "\\") at++
            else if (char === quote) quote = null
        } else if (char === '"' || char === "'") quote = char
        else if (char === "(" || char === "[") depth++
        else if (char === ")" || char === "]") depth--
        else if (char === "\\") at++
        else if (depth === 0 && text.startsWith(separator, at)) {
            parts.push(text.slice(start, at))
            start = at + separator.length
            at += separator.length - 1
        }
    }
    parts.push(text.slice(start))
    return parts
}

// Where the bracket or parenthesis opened at `open` closes
const closing = (text: string, open: number) => {
    const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" }
    const close = pairs[text[open]]
    let depth = 0
    let quote: string | null = null
    for (let at = open; at < text.length; at++) {
        const char = text[at]
        if (quote) {
            if (char === "\\") at++
            else if (char === quote) quote = null
        } else if (char === '"' || char === "'") quote = char
        else if (char === text[open]) depth++
        else if (char === close && --depth === 0) return at
    }
    return text.length
}

// An identifier from `start`, escapes read: .md\:flex is the class "md:flex"
const readIdentifier = (text: string, start: number) => {
    let name = ""
    let at = start
    while (at < text.length) {
        const char = text[at]
        if (char === "\\" && at + 1 < text.length) {
            const hex = /^[0-9a-f]{1,6}\s?/i.exec(text.slice(at + 1))
            if (hex) {
                name += String.fromCodePoint(parseInt(hex[0], 16))
                at += 1 + hex[0].length
            } else {
                name += text[at + 1]
                at += 2
            }
        } else if (/[\w-]/.test(char) || char.charCodeAt(0) > 127) {
            name += char
            at++
        } else break
    }
    return { name, end: at }
}

const parseCompoundList = (text: string): Compound[] | null => {
    const list: Compound[] = []
    for (const part of splitOutside(text, ",")) {
        const selector = parseSelector(part)
        if (!selector || selector.compounds.length !== 1) return null
        list.push(selector.compounds[0])
    }
    return list
}

export const parseSelector = (text: string): Selector | null => {
    const source = text.trim()
    const compounds: Compound[] = [[]]
    const combinators: Combinator[] = []
    let at = 0
    while (at < source.length) {
        const char = source[at]
        if (/[\s>+~]/.test(char)) {
            let combinator: Combinator = " "
            while (at < source.length && /[\s>+~]/.test(source[at])) {
                if (!/\s/.test(source[at])) combinator = source[at] as Combinator
                at++
            }
            if (at >= source.length) break
            if (compounds[compounds.length - 1].length === 0) return null
            combinators.push(combinator)
            compounds.push([])
            continue
        }
        const compound = compounds[compounds.length - 1]
        if (char === "*") {
            compound.push({ type: "universal" })
            at++
        } else if (char === "#" || char === ".") {
            const { name, end } = readIdentifier(source, at + 1)
            if (!name) return null
            compound.push({ type: char === "#" ? "id" : "class", name })
            at = end
        } else if (char === "[") {
            const end = closing(source, at)
            const inside = source.slice(at + 1, end)
            const parsed = /^\s*([\w:-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*([is])?)?\s*$/i.exec(inside)
            if (!parsed) return null
            compound.push({ type: "attribute", name: parsed[1].toLowerCase(), operator: parsed[2] ?? null, value: parsed[3] ?? parsed[4] ?? parsed[5] ?? "", insensitive: parsed[6]?.toLowerCase() === "i" })
            at = end + 1
        } else if (char === ":") {
            const isElement = source[at + 1] === ":"
            const { name, end } = readIdentifier(source, at + (isElement ? 2 : 1))
            let argument: string | null = null
            at = end
            if (source[at] === "(") {
                const close = closing(source, at)
                argument = source.slice(at + 1, close)
                at = close + 1
            }
            const lower = name.toLowerCase()
            if (isElement || NEVER.has(lower)) compound.push({ type: "never" })
            else if (lower === "not" || lower === "is" || lower === "where" || lower === "matches") {
                const list = argument === null ? null : parseCompoundList(argument)
                if (!list) return null
                compound.push({ type: "logical", name: lower === "matches" ? "is" : lower, list })
            } else if (POSITIONAL.has(lower)) compound.push({ type: "position", name: lower, argument })
            else return null
        } else if (/[a-zA-Z]/.test(char)) {
            const { name, end } = readIdentifier(source, at)
            compound.push({ type: "tag", name: name.toLowerCase() })
            at = end
        } else return null
    }
    if (compounds.some((compound) => compound.length === 0)) return null
    return { compounds, combinators }
}

// ids, then classes, attributes and pseudo-classes, then tags, as one number
const specificityOf = (compounds: Compound[]): number =>
    compounds.reduce((total, compound) => total + compound.reduce((sum, simple) => {
        switch (simple.type) {
            case "id": return sum + 10_000
            case "class": case "attribute": case "position": return sum + 100
            case "tag": return sum + 1
            case "logical": return simple.name === "where" ? sum : sum + Math.max(0, ...simple.list.map((item) => specificityOf([item])))
            default: return sum
        }
    }, 0), 0)

const siblingsOf = (node: HtmlElement) => (node.parent ? node.parent.children.filter((child): child is HtmlElement => child.kind === "element") : [node])

// Whether position `index` (1-based) fits an+b, odd or even
const fitsNth = (argument: string | null, index: number) => {
    const formula = (argument ?? "").trim().toLowerCase().replace(/\s+/g, "")
    if (formula === "odd") return index % 2 === 1
    if (formula === "even") return index % 2 === 0
    const match = /^([+-]?\d*)?n([+-]\d+)?$/.exec(formula)
    if (!match) return Number(formula) === index
    const a = match[1] === "" || match[1] === "+" || match[1] === undefined ? 1 : match[1] === "-" ? -1 : Number(match[1])
    const b = Number(match[2] ?? 0)
    if (a === 0) return index === b
    return (index - b) / a >= 0 && Number.isInteger((index - b) / a)
}

const matchesSimple = (node: HtmlElement, simple: Simple): boolean => {
    switch (simple.type) {
        case "universal": return true
        case "tag": return node.tag === simple.name || (node.tag === ROOT && (simple.name === "html" || simple.name === "body"))
        case "id": return node.attributes.get("id") === simple.name
        case "class": return node.classes.includes(simple.name)
        case "attribute": {
            if (!node.attributes.has(simple.name)) return false
            if (!simple.operator) return true
            const actual = simple.insensitive ? node.attributes.get(simple.name)!.toLowerCase() : node.attributes.get(simple.name)!
            const wanted = simple.insensitive ? simple.value.toLowerCase() : simple.value
            switch (simple.operator) {
                case "=": return actual === wanted
                case "~=": return actual.split(/\s+/).includes(wanted)
                case "|=": return actual === wanted || actual.startsWith(`${wanted}-`)
                case "^=": return wanted !== "" && actual.startsWith(wanted)
                case "$=": return wanted !== "" && actual.endsWith(wanted)
                case "*=": return wanted !== "" && actual.includes(wanted)
                default: return false
            }
        }
        case "position": {
            if (simple.name === "root") return node.tag === ROOT
            if (simple.name === "empty") return node.children.every((child) => child.kind === "text" && !child.text.trim())
            if (simple.name === "disabled") return node.attributes.has("disabled")
            if (simple.name === "enabled") return ["button", "input", "select", "textarea"].includes(node.tag) && !node.attributes.has("disabled")
            if (simple.name === "required") return node.attributes.has("required")
            if (simple.name === "optional") return ["input", "select", "textarea"].includes(node.tag) && !node.attributes.has("required")
            if (simple.name === "link" || simple.name === "any-link") return (node.tag === "a" || node.tag === "area") && node.attributes.has("href")
            const ofType = simple.name.endsWith("of-type")
            const siblings = siblingsOf(node).filter((sibling) => !ofType || sibling.tag === node.tag)
            const index = siblings.indexOf(node) + 1
            const fromEnd = siblings.length - index + 1
            if (simple.name === "first-child" || simple.name === "first-of-type") return index === 1
            if (simple.name === "last-child" || simple.name === "last-of-type") return fromEnd === 1
            if (simple.name === "only-child") return siblings.length === 1
            if (simple.name === "nth-last-child") return fitsNth(simple.argument, fromEnd)
            return fitsNth(simple.argument, index)
        }
        case "logical": {
            const any = simple.list.some((compound) => compound.every((item) => matchesSimple(node, item)))
            return simple.name === "not" ? !any : any
        }
        case "never": return false
    }
}

// Each descendant combinator walks up the ancestors, so on a page nested thousands deep a selector
// with several of them could take very long. A match gets this many steps, and is no match past them.
const MATCH_BUDGET = 2_000

export const matchesSelector = (node: HtmlElement, selector: Selector): boolean => {
    let steps = 0
    const at = (candidate: HtmlElement, index: number): boolean => {
        if (++steps > MATCH_BUDGET) return false
        if (!selector.compounds[index].every((simple) => matchesSimple(candidate, simple))) return false
        if (index === 0) return true
        const combinator = selector.combinators[index - 1]
        if (combinator === ">") return candidate.parent ? at(candidate.parent, index - 1) : false
        if (combinator === " ") {
            for (let ancestor = candidate.parent; ancestor; ancestor = ancestor.parent) if (at(ancestor, index - 1)) return true
            return false
        }
        const siblings = siblingsOf(candidate)
        const before = siblings.slice(0, siblings.indexOf(candidate))
        if (combinator === "+") return before.length > 0 && at(before[before.length - 1], index - 1)
        return before.some((sibling) => at(sibling, index - 1))
    }
    return at(node, selector.compounds.length - 1)
}

// --- Stylesheets -------------------------------------------------------------------------------

export type StyleRule = { selector: Selector; text: string; specificity: number; order: number; declarations: Declaration[] }

// A declaration as written, for checks that read every color in the CSS
export type WrittenDeclaration = Declaration & { selector: string }

export const parseDeclarations = (body: string): Declaration[] =>
    splitOutside(body, ";").flatMap((part) => {
        const colon = part.indexOf(":")
        if (colon === -1) return []
        const name = part.slice(0, colon).trim()
        let value = part.slice(colon + 1).trim()
        if (!name || !value) return []
        const important = /!\s*important\s*$/i.test(value)
        if (important) value = value.replace(/!\s*important\s*$/i, "").trim()
        return [{ property: name.startsWith("--") ? name : name.toLowerCase(), value, important }]
    })

const REM = 16

// A media query's width conditions, checked at the frame's width. Anything else it asks (print, a
// color scheme, hover) is unknown, so the rules inside don't apply.
export const mediaApplies = (query: string, width: number) => {
    const length = (value: string) => {
        const amount = parseFloat(value)
        return /r?em$/i.test(value.trim()) ? amount * REM : amount
    }
    return splitOutside(query, ",").some((option) => {
        const parts = option.trim().toLowerCase().split(/\s+and\s+/)
        return parts.every((part) => {
            if (part === "screen" || part === "all" || part === "only screen") return true
            const condition = /^\(\s*(min|max)-width\s*:\s*([\d.]+(?:px|r?em)?)\s*\)$/.exec(part)
            if (condition) return condition[1] === "min" ? width >= length(condition[2]) : width <= length(condition[2])
            const range = /^\(\s*width\s*(>=|<=|>|<)\s*([\d.]+(?:px|r?em)?)\s*\)$/.exec(part)
            if (range) {
                const limit = length(range[2])
                return range[1] === ">=" ? width >= limit : range[1] === "<=" ? width <= limit : range[1] === ">" ? width > limit : width < limit
            }
            return false
        })
    })
}

// The rules of a <style> block that apply at `width`, and every declaration written, wherever it is
export const parseStylesheet = (css: string, width: number) => {
    const rules: StyleRule[] = []
    const written: WrittenDeclaration[] = []
    let order = 0
    const block = (text: string, applies: boolean) => {
        let index = 0
        while (index < text.length) {
            const open = text.indexOf("{", index)
            if (open === -1) break
            const prelude = text.slice(index, open).replace(/^[\s;]+/, "").trim()
            const close = closing(text, open)
            const body = text.slice(open + 1, close)
            index = close + 1
            if (prelude.startsWith("@")) {
                const name = /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase()
                if (name === "media") block(body, applies && mediaApplies(prelude.slice(6), width))
                else if (name === "supports" || name === "layer" || name === "scope") block(body, applies)
                // @keyframes, @font-face and the like hold no rules for the page
                continue
            }
            const declarations = parseDeclarations(body)
            for (const declaration of declarations) written.push({ ...declaration, selector: prelude })
            if (!applies) continue
            for (const part of splitOutside(prelude, ",")) {
                const selector = parseSelector(part)
                if (selector) rules.push({ selector, text: part.trim(), specificity: specificityOf(selector.compounds), order: order++, declarations })
            }
        }
    }
    block(css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, ""), true)
    return { rules, written }
}

// --- Tailwind classes --------------------------------------------------------------------------

// A Tailwind class as the frame compiles it: its declarations, whether its variants hold at the
// frame's width (sm:, md:, dark: do; hover: never), and the colors it paints with, for the palette
export type Utility = {
    applies: boolean
    important: boolean
    // Variants make a class come later in the compiled CSS: md:x beats x
    rank: number
    declarations: Declaration[]
    colors: { property: string; color: Rgba; theme: boolean }[]
}

const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 }

const FONT_SIZES: Record<string, number> = { xs: 0.75, sm: 0.875, base: 1, lg: 1.125, xl: 1.25, "2xl": 1.5, "3xl": 1.875, "4xl": 2.25, "5xl": 3, "6xl": 3.75, "7xl": 4.5, "8xl": 6, "9xl": 8 }

const FONT_WEIGHTS: Record<string, number> = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }

const DISPLAYS = new Set(["block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid", "table", "table-row", "table-cell", "contents", "flow-root", "list-item"])

// The utilities that take a color, by the CSS property they set
const COLOR_UTILITIES: [prefix: string, property: string][] = [
    ["text", "color"], ["bg", "background-color"], ["border-x", "border-color"], ["border-y", "border-color"], ["border-t", "border-color"],
    ["border-r", "border-color"], ["border-b", "border-color"], ["border-l", "border-color"], ["border-s", "border-color"], ["border-e", "border-color"],
    ["border", "border-color"], ["divide", "border-color"], ["outline", "outline-color"], ["ring-offset", "--tw-ring-offset-color"], ["ring", "--tw-ring-color"],
    ["fill", "fill"], ["stroke", "stroke"], ["decoration", "text-decoration-color"], ["accent", "accent-color"], ["caret", "caret-color"],
    ["placeholder", "--placeholder-color"], ["from", "--tw-gradient-from"], ["via", "--tw-gradient-via"], ["to", "--tw-gradient-to"],
]

// A Tailwind length: 12 (12 × 0.25rem), px, full, [420px], 1/2
const spacingLength = (value: string): string | null => {
    if (/^\d+(\.\d+)?$/.test(value)) return `${Number(value) * 0.25}rem`
    if (value === "px") return "1px"
    if (value === "full") return "100%"
    if (value === "auto" || value === "fit" || value === "min" || value === "max") return value === "auto" ? "auto" : `${value}-content`
    if (/^(screen|svh|lvh|dvh)$/.test(value)) return "100vh"
    if (/^\d+\/\d+$/.test(value)) {
        const [a, b] = value.split("/").map(Number)
        return `${(a / b) * 100}%`
    }
    const arbitrary = /^\[(.+)\]$/.exec(value)
    return arbitrary ? arbitrary[1].replace(/_/g, " ") : null
}

export const utility = (className: string, width: number, variable: (name: string) => string | null = () => null): Utility => {
    const parts = splitOutside(className, ":")
    let base = parts.pop() ?? ""
    let rank = 0
    let applies = true
    for (const variant of parts) {
        if (variant === "dark") rank += 0.5
        else if (BREAKPOINTS[variant] !== undefined) {
            applies &&= width >= BREAKPOINTS[variant]
            rank += Object.keys(BREAKPOINTS).indexOf(variant) + 1
        } else if (variant.startsWith("max-") && BREAKPOINTS[variant.slice(4)] !== undefined) applies &&= width < BREAKPOINTS[variant.slice(4)]
        else if (/^min-\[[\d.]+px\]$/.test(variant)) applies &&= width >= parseFloat(variant.slice(5))
        else if (/^max-\[[\d.]+px\]$/.test(variant)) applies &&= width < parseFloat(variant.slice(5))
        else if (variant !== "motion-safe" && variant !== "ltr") applies = false
    }
    const important = base.startsWith("!") || base.endsWith("!")
    base = base.replace(/^!|!$/g, "")
    const result: Utility = { applies, important, rank, declarations: [], colors: [] }
    const set = (property: string, value: string) => result.declarations.push({ property, value, important })

    if (base === "hidden") set("display", "none")
    else if (DISPLAYS.has(base)) set("display", base)
    else if (base === "sr-only") set("--linea-sr-only", "1")
    else if (base === "not-sr-only") set("--linea-sr-only", "0")
    else if (base === "invisible") set("visibility", "hidden")
    else if (base === "visible") set("visibility", "visible")
    else if (base === "absolute" || base === "fixed" || base === "relative" || base === "sticky" || base === "static") set("position", base)
    else if (/^inset-(0|\[0(px)?\])$/.test(base)) ["top", "right", "bottom", "left"].forEach((side) => set(side, "0"))
    else if (/^inset-y-0$/.test(base)) ["top", "bottom"].forEach((side) => set(side, "0"))
    else if (/^opacity-/.test(base)) {
        const value = base.slice(8)
        const amount = /^\d+$/.test(value) ? Number(value) / 100 : /^\[(.+)\]$/.test(value) ? parseFloat(value.slice(1, -1)) * (value.includes("%") ? 0.01 : 1) : NaN
        if (Number.isFinite(amount)) set("opacity", String(amount))
    } else if (/^font-/.test(base)) {
        const value = base.slice(5)
        if (FONT_WEIGHTS[value]) set("font-weight", String(FONT_WEIGHTS[value]))
        else if (/^\[\d+\]$/.test(value)) set("font-weight", value.slice(1, -1))
    } else if (/^aspect-/.test(base)) {
        const value = base.slice(7)
        const ratio = value === "square" ? "1 / 1" : value === "video" ? "16 / 9" : value === "auto" ? "auto"
            : /^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(value) ? value.replace("/", " / ")
                : /^[[(](.+)[\])]$/.exec(value)?.[1]?.replace(/_/g, " ") ?? null
        if (ratio) set("aspect-ratio", ratio)
    } else if (/^(min-h|h|size)-/.test(base)) {
        const [, prefix, value] = /^(min-h|h|size)-(.+)$/.exec(base)!
        const length = spacingLength(value)
        if (length) set(prefix === "min-h" ? "min-height" : "height", length)
    } else if (/^bg-(gradient-to-|linear-|radial|conic)/.test(base)) set("background-image", "linear-gradient(transparent, transparent)")
    else if (base === "bg-none") set("background-image", "none")
    else if (/^bg-\[url\(/.test(base) || /^bg-\[image:/.test(base)) set("background-image", "url()")
    else if (/^text-/.test(base)) {
        const value = base.slice(5)
        const size = /^([a-z0-9]+)(?:\/.+)?$/.exec(value)?.[1]
        if (size && FONT_SIZES[size] !== undefined) set("font-size", `${FONT_SIZES[size]}rem`)
        else if (/^\[(?:length:)?[\d.]+(px|rem|em|%)\]$/.test(value)) set("font-size", value.replace(/^\[(?:length:)?|\]$/g, ""))
    }

    for (const [prefix, property] of COLOR_UTILITIES) {
        if (!base.startsWith(`${prefix}-`)) continue
        const resolved = tailwindColor(base.slice(prefix.length + 1), variable)
        if (resolved) {
            result.colors.push({ property, ...resolved })
            if (property === "color" || property === "background-color") set(property, `rgba(${resolved.color.r}, ${resolved.color.g}, ${resolved.color.b}, ${resolved.color.a})`)
        }
        break
    }
    return result
}

// --- Computed styles ---------------------------------------------------------------------------

export type ComputedStyle = {
    // The element's own declared values after the cascade, var() resolved
    values: Map<string, string>
    // Text color; null when it can't be read (color-mix() and the like)
    color: Rgba | null
    // The opaque surface the element's content is drawn on, before any opacity; null when it's an
    // image or a gradient, whose color under the text isn't known
    surface: Rgba | null
    opacity: number
    // px
    fontSize: number
    fontWeight: number
    // Not shown: display none, visibility hidden or sr-only, here or around it
    hidden: boolean
    variables: Map<string, string>
}

// Replaces var(--x, fallback) with the variable's value, as deep as variables nest
const resolveVariables = (value: string, variables: Map<string, string>, depth = 0): string => {
    if (depth > 8 || !value.includes("var(")) return value
    let output = ""
    let index = 0
    for (let at = value.indexOf("var(", index); at !== -1; at = value.indexOf("var(", index)) {
        const close = closing(value, at + 3)
        const [name, ...fallback] = splitOutside(value.slice(at + 4, close), ",")
        const replacement = variables.get(name.trim()) ?? (fallback.length ? fallback.join(",").trim() : "")
        output += value.slice(index, at) + resolveVariables(replacement, variables, depth + 1)
        index = close + 1
    }
    return output + value.slice(index)
}

// A font size in px, or null when it can't be read
const fontSizeOf = (value: string, parent: number): number | null => {
    const text = value.trim().toLowerCase()
    const keywords: Record<string, number> = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32, "xxx-large": 48 }
    if (keywords[text]) return keywords[text]
    if (text === "smaller") return parent / 1.2
    if (text === "larger") return parent * 1.2
    // On a desktop frame, clamp() and max() reach their largest
    const call = /^(clamp|min|max)\((.*)\)$/.exec(text)
    if (call) {
        const values = splitOutside(call[2], ",").map((part) => fontSizeOf(part, parent)).filter((size): size is number => size !== null)
        if (values.length === 0) return null
        return call[1] === "min" ? Math.min(...values) : Math.max(...values)
    }
    const match = /^(-?[\d.]+)(px|rem|em|%|pt)$/.exec(text)
    if (!match) return null
    const amount = Number(match[1])
    switch (match[2]) {
        case "px": return amount
        case "rem": return amount * REM
        case "em": return amount * parent
        case "%": return (amount / 100) * parent
        default: return (amount * 4) / 3
    }
}

const fontWeightOf = (value: string, parent: number): number | null => {
    const text = value.trim().toLowerCase()
    if (text === "normal") return 400
    if (text === "bold") return 700
    if (text === "bolder") return parent < 400 ? 400 : parent < 600 ? 700 : 900
    if (text === "lighter") return parent < 600 ? 100 : parent < 800 ? 400 : 700
    const number = Number(text)
    return Number.isFinite(number) && number > 0 ? number : null
}

const IMAGE_VALUE = /gradient\(|url\(|image\(|element\(/i

// The background an element paints: a color, "image" for a gradient or picture, or null for none
const backgroundOf = (values: Map<string, string>): Rgba | "image" | null => {
    const image = values.get("background-image")
    if (image && image.trim().toLowerCase() !== "none") return "image"
    const color = values.get("background-color")
    if (!color) return null
    const text = color.trim().toLowerCase()
    if (text === "none" || text === "transparent" || text === "initial" || text === "unset" || text === "inherit") return null
    const parsed = parseColor(text) ?? colorsIn(text)[0]?.color ?? null
    // A background this can't read could be any color, so what's on it can't be checked
    return parsed ?? "image"
}

// The elements whose defaults matter for text: bold table headers and <b>, Tailwind's preflight
// leaves headings at the size and weight around them
const DEFAULT_WEIGHT: Record<string, string> = { th: "bold", b: "bolder", strong: "bolder" }

export type StyleSheet = ReturnType<typeof parseStylesheet>

const ROOT_STYLE: ComputedStyle = { values: new Map(), color: FRAME_TEXT, surface: FRAME_BACKDROP, opacity: 1, fontSize: REM, fontWeight: 400, hidden: false, variables: new Map() }

// One element's computed style, from its parent's
const styleOf = (node: HtmlElement, parent: ComputedStyle, sheet: StyleSheet, width: number): ComputedStyle => {
    const matched = sheet.rules
        .filter((rule) => matchesSelector(node, rule.selector))
        .sort((a, b) => a.specificity - b.specificity || a.order - b.order)
    const inline = parseDeclarations(node.attributes.get("style") ?? "")
    // Variables first, since the classes and rules below may read them. An element's own variables
    // can refer to each other (--paper: var(--sand)), so they're all set before any is resolved. An
    // element that sets none shares its parent's.
    const own = new Map<string, string>()
    for (const declaration of [...matched.flatMap((rule) => rule.declarations), ...inline]) {
        if (declaration.property.startsWith("--")) own.set(declaration.property, declaration.value)
    }
    const variables = own.size === 0 ? parent.variables : new Map(parent.variables)
    for (const [name, value] of own) variables.set(name, value)
    for (const [name, value] of own) variables.set(name, resolveVariables(value, variables))
    const variable = (name: string) => variables.get(name) ?? null
    const utilities = node.classes.map((name) => utility(name, width, variable)).filter((item) => item.applies)
    utilities.sort((a, b) => a.rank - b.rank)

    // Weakest first; a later declaration of a property wins
    const ordered: Declaration[] = [
        ...(DEFAULT_WEIGHT[node.tag] ? [{ property: "font-weight", value: DEFAULT_WEIGHT[node.tag], important: false }] : []),
        ...(node.attributes.has("hidden") ? [{ property: "display", value: "none", important: false }] : []),
        ...utilities.flatMap((item) => item.declarations.filter((declaration) => !declaration.important)),
        ...matched.flatMap((rule) => rule.declarations.filter((declaration) => !declaration.important)),
        ...inline.filter((declaration) => !declaration.important),
        ...matched.flatMap((rule) => rule.declarations.filter((declaration) => declaration.important)),
        ...inline.filter((declaration) => declaration.important),
        ...utilities.flatMap((item) => item.declarations.filter((declaration) => declaration.important)),
    ]
    const values = new Map<string, string>()
    for (const declaration of ordered) {
        if (declaration.property.startsWith("--") && declaration.property !== "--linea-sr-only") continue
        const value = resolveVariables(declaration.value, variables)
        // The shorthand sets both, so whichever declaration comes later in the cascade wins
        if (declaration.property === "background") {
            const isImage = IMAGE_VALUE.test(value)
            values.set("background-image", isImage ? value : "none")
            values.set("background-color", isImage ? "transparent" : parseColor(value) ? value : colorsIn(value)[0]?.text ?? (/^\s*none\s*$/i.test(value) ? "transparent" : value))
            continue
        }
        values.set(declaration.property, value)
    }

    const colorValue = values.get("color")?.trim().toLowerCase()
    const color = !colorValue || colorValue === "inherit" || colorValue === "currentcolor" || colorValue === "unset" ? parent.color : parseColor(colorValue)
    const background = backgroundOf(values)
    const surface = background === "image" ? null
        : background === null ? parent.surface
            : background.a >= 1 ? background
                : parent.surface ? over(background, parent.surface) : null
    const opacityValue = values.get("opacity")
    const opacity = opacityValue === undefined ? 1 : Math.min(1, Math.max(0, opacityValue.trim().endsWith("%") ? parseFloat(opacityValue) / 100 : parseFloat(opacityValue)))
    const display = values.get("display")?.trim().toLowerCase()
    const visibility = values.get("visibility")?.trim().toLowerCase()
    return {
        values,
        color,
        surface,
        opacity: Number.isFinite(opacity) ? opacity : 1,
        fontSize: values.has("font-size") ? fontSizeOf(values.get("font-size")!, parent.fontSize) ?? parent.fontSize : parent.fontSize,
        fontWeight: values.has("font-weight") ? fontWeightOf(values.get("font-weight")!, parent.fontWeight) ?? parent.fontWeight : parent.fontWeight,
        hidden: parent.hidden || display === "none" || visibility === "hidden" || values.get("--linea-sr-only") === "1",
        variables,
    }
}

// Every element's computed style. `width` is the frame's, for media queries and sm:/md: classes.
// Each element comes after its parent, walked with a list rather than recursion, so a page nested
// thousands deep can't overflow the call stack.
export const computeStyles = (root: HtmlElement, sheet: StyleSheet, width: number) => {
    const styles = new Map<HtmlElement, ComputedStyle>()
    const pending: [HtmlElement, ComputedStyle][] = [[root, ROOT_STYLE]]
    while (pending.length > 0) {
        const [node, parent] = pending.pop()!
        const style = styleOf(node, parent, sheet, width)
        styles.set(node, style)
        for (let index = node.children.length - 1; index >= 0; index--) {
            const child = node.children[index]
            if (child.kind === "element") pending.push([child, style])
        }
    }
    return styles
}

// The text and the surface under it as they're drawn, with every opacity around them applied, or
// null when either can't be known
export const drawnColors = (node: HtmlElement, styles: Map<HtmlElement, ComputedStyle>): { text: Rgba; surface: Rgba } | null => {
    const style = styles.get(node)
    if (!style?.color || !style.surface) return null
    let text = over(style.color, style.surface)
    let surface = style.surface
    for (let at: HtmlElement | null = node; at && at.tag !== ROOT; at = at.parent) {
        const own = styles.get(at)!
        if (own.opacity >= 1) continue
        const outside = at.parent ? styles.get(at.parent)?.surface : FRAME_BACKDROP
        if (!outside) return null
        text = over({ ...text, a: own.opacity }, outside)
        surface = over({ ...surface, a: own.opacity }, outside)
    }
    return { text, surface }
}
