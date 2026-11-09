import { BANNED_COPY_WORDS } from "../prompts/design"
import { COLOR_ROLES, CONTRAST_PAIRS, LARGE_TEXT_CONTRAST, NORMAL_TEXT_CONTRAST, contrastRatio, type ColorRole, type DesignContract } from "./design-contract"
import { colorsIn, toHex, type Rgba } from "./design-colors"
import { computeStyles, drawnColors, parseDeclarations, parseStylesheet, splitOutside, utility, type ComputedStyle } from "./design-styles"
import { clipText, describeElement, elementChildren, elementsOf, isWithin, nearestId, ownText, parseHtml, textContent, ROOT, type HtmlElement } from "./html-tree"

// Checks a finished design for what a reader would call broken, without judging taste: text that
// can't be read, colors from outside the design contract, copy the copy policy rules out, made-up
// people and placeholder text, a table column twice, images that collapse when they don't load, and
// inline SVG, which the design's frame removes. Pure: the same HTML, contract and context always give
// the same issues. An error is worth one repair call (src/lib/design-generation.ts); a warning is
// only reported.

export type IssueKind = "contrast" | "color" | "copy" | "name" | "placeholder" | "duplicate-column" | "image-size" | "inline-svg"

export type Issue = {
    kind: IssueKind
    severity: "error" | "warning"
    // What's wrong, where, and what fixes it, in one line: the repair request lists these as they are
    message: string
    // The same problem in another version of the page has the same key
    key: string
    // How many places it's in
    count: number
}

export type ValidationContext = {
    mode?: "initial" | "refine" | "workflow"
    // Words the user supplied (the wireframe's copy, their request): the copy rules don't overrule them
    suppliedText?: string
    // The page this one was made from: a refine's current page, a workflow page's main page. A problem
    // it already had is a warning here, not an error, since a change shouldn't fix what nobody asked about.
    previousHtml?: string
    // A refine that asks for a color, which may be one the contract doesn't have
    colorRequested?: boolean
    // The frame's width in px, for media queries and sm:/md: classes
    width?: number
}

export const DEFAULT_FRAME_WIDTH = 1280

// Where page text doesn't show, or isn't the page's copy
const NOT_COPY = new Set(["style", "script", "template", "noscript", "svg", "math", "title"])

// --- Reading the page --------------------------------------------------------------------------

type Page = {
    root: HtmlElement
    all: HtmlElement[]
    styles: Map<HtmlElement, ComputedStyle>
    sheet: ReturnType<typeof parseStylesheet>
    width: number
}

const readPage = (html: string, width: number): Page => {
    const root = parseHtml(html)
    const all = elementsOf(root)
    const css = all
        .filter((node) => node.tag === "style")
        .map((node) => node.children.map((child) => (child.kind === "text" ? child.text : "")).join(""))
        .join("\n")
    const sheet = parseStylesheet(css, width)
    return { root, all, styles: computeStyles(root, sheet, width), sheet, width }
}

// Where an element is, for a message: "<span class="pill"> in #orders-table"
const where = (node: HtmlElement) => {
    const around = nearestId(node.parent)
    return `${describeElement(node)}${around && around !== `#${node.attributes.get("id")}` ? ` in ${around}` : ""}`
}

const places = (count: number) => (count > 1 ? ` (${count} places)` : "")

const quote = (text: string) => `"${clipText(text, 60)}"`

// --- Contrast ----------------------------------------------------------------------------------

const BACKGROUND_CLASS: Partial<Record<ColorRole, string>> = {
    background: "c-bg", card: "c-card-bg", popover: "c-popover-bg", primary: "c-primary-bg", secondary: "c-secondary-bg",
    muted: "c-muted-bg", accent: "c-accent-bg", destructive: "c-destructive-bg",
}
const TEXT_CLASS: Partial<Record<ColorRole, string>> = {
    foreground: "c-fg", cardForeground: "c-card-fg", popoverForeground: "c-popover-fg", primaryForeground: "c-primary-fg",
    secondaryForeground: "c-secondary-fg", mutedForeground: "c-muted-fg", accentForeground: "c-accent-fg", destructiveForeground: "c-destructive-fg",
}

// What to use on a surface: its own text class when the surface is one of the contract's
const contrastFix = (surface: string, contract: DesignContract) => {
    const role = COLOR_ROLES.find((name) => BACKGROUND_CLASS[name] && contract.colors[name].toUpperCase() === surface)
    const pair = role ? CONTRAST_PAIRS.find(([background]) => background === role) : null
    if (role && pair && TEXT_CLASS[pair[1]]) return `Use ${TEXT_CLASS[pair[1]]} on this ${BACKGROUND_CLASS[role]}, or give the text its own matching pair (c-primary-bg with c-primary-fg).`
    return "Give the text and its surface a matching .c-* pair (c-primary-bg with c-primary-fg, c-card-bg with c-card-fg)."
}

const isDisabled = (node: HtmlElement) => {
    for (let at: HtmlElement | null = node; at; at = at.parent) {
        if (at.attributes.has("disabled") || at.attributes.get("aria-disabled") === "true") return true
    }
    return false
}

const contrastIssues = (page: Page, contract: DesignContract): Issue[] => {
    const groups = new Map<string, { node: HtmlElement; text: string; fg: string; bg: string; ratio: number; needed: number; count: number }>()
    for (const node of page.all) {
        const text = ownText(node)
        if (!/[\p{L}\p{N}]/u.test(text) || isWithin(node, NOT_COPY) || node.tag === "option" || node.tag === "textarea") continue
        const style = page.styles.get(node)!
        if (style.hidden || isDisabled(node)) continue
        const drawn = drawnColors(node, page.styles)
        if (!drawn) continue
        const [fg, bg] = [toHex(drawn.text), toHex(drawn.surface)]
        const ratio = contrastRatio(fg, bg)
        const large = style.fontSize >= 24 || (style.fontSize >= 18.66 && style.fontWeight >= 700)
        const needed = large ? LARGE_TEXT_CONTRAST : NORMAL_TEXT_CONTRAST
        if (ratio >= needed) continue
        const key = `contrast|${fg}|${bg}|${describeElement(node)}`
        const group = groups.get(key)
        if (group) group.count++
        else groups.set(key, { node, text, fg, bg, ratio, needed, count: 1 })
    }
    return [...groups.entries()].map(([key, group]) => ({
        kind: "contrast",
        severity: "error",
        key,
        count: group.count,
        message: `Contrast ${group.ratio.toFixed(2)}:1, under ${group.needed}:1: text ${quote(group.text)} in ${where(group.node)}${places(group.count)} is ${group.fg} on ${group.bg}. ${contrastFix(group.bg, contract)}`,
    }))
}

// --- Colors outside the contract ---------------------------------------------------------------

// Properties that paint a color. Shadows and filters don't count: a soft black shadow isn't a palette color.
const PAINTS = /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|text-decoration(-color)?|column-rule(-color)?|caret-color|accent-color|fill|stroke|stop-color|flood-color|--.+)$/

// States the design's frame never shows: it's inert, so nothing in it is hovered, focused or pressed
const STATE_SELECTOR = /:(?:hover|focus|focus-visible|focus-within|active|visited|checked|disabled)\b/i
const isStateClass = (name: string) =>
    splitOutside(name, ":").slice(0, -1).some((variant) => /^(?:hover|focus|focus-visible|focus-within|active|visited|checked|disabled|group-|peer-)/.test(variant))

const colorIssues = (page: Page, contract: DesignContract, context: ValidationContext): Issue[] => {
    const palette = new Set(Object.values(contract.colors).map((hex) => hex.toUpperCase()))
    // Each color's places, and whether every one of them is a state the frame never shows
    const found = new Map<string, { spots: Map<string, number>; onlyStates: boolean }>()
    const add = (color: Rgba, place: string, state: boolean) => {
        if (color.a === 0) return
        const hex = toHex(color)
        // Any shade of the contract's colors is the contract's color, and see-through black or white is a
        // scrim, a hairline or a shadow rather than a palette color
        if (palette.has(hex) || (color.a < 1 && (hex === "#000000" || hex === "#FFFFFF"))) return
        const entry = found.get(hex) ?? { spots: new Map<string, number>(), onlyStates: true }
        entry.spots.set(place, (entry.spots.get(place) ?? 0) + 1)
        entry.onlyStates &&= state
        found.set(hex, entry)
    }
    for (const declaration of page.sheet.written) {
        if (!PAINTS.test(declaration.property)) continue
        for (const { color } of colorsIn(declaration.value)) add(color, `${clipText(declaration.selector, 40)} { ${declaration.property} }`, STATE_SELECTOR.test(declaration.selector))
    }
    for (const node of page.all) {
        if (node.tag === ROOT || isWithin(node, new Set(["svg", "math"]))) continue
        for (const declaration of parseDeclarations(node.attributes.get("style") ?? "")) {
            if (!PAINTS.test(declaration.property)) continue
            for (const { color } of colorsIn(declaration.value)) add(color, `style="${declaration.property}: …" on ${describeElement(node)}`, false)
        }
        for (const name of node.classes) {
            for (const painted of utility(name, page.width).colors) add(painted.color, painted.theme ? `${name} (Linea's own theme color)` : name, isStateClass(name))
        }
    }
    return [...found.entries()].map(([hex, { spots, onlyStates }]) => {
        const count = [...spots.values()].reduce((sum, value) => sum + value, 0)
        const list = [...spots.entries()].slice(0, 3).map(([place, times]) => (times > 1 ? `${place} ×${times}` : place))
        // A hover or focus color is off the contract too, but no one sees it in the frame: not worth a repair
        const warning = onlyStates || (context.mode === "refine" && context.colorRequested)
        return {
            kind: "color",
            severity: warning ? "warning" : "error",
            key: `color|${hex}`,
            count,
            message: `Color ${hex} isn't in the design contract: ${list.join(", ")}${spots.size > 3 ? ` and ${spots.size - 3} more` : ""}. Use the contract's colors, through the .c-* classes.`,
        } satisfies Issue
    })
}

// --- Copy --------------------------------------------------------------------------------------

// A piece of the page's copy and the element it's in: text, and what form fields show
type Copy = { text: string; node: HtmlElement }

const copyOf = (page: Page): Copy[] => {
    const copy: Copy[] = []
    for (const node of page.all) {
        if (isWithin(node, NOT_COPY)) continue
        const text = ownText(node)
        if (text) copy.push({ text, node })
        if (node.tag === "input" || node.tag === "textarea") {
            const type = (node.attributes.get("type") ?? "text").toLowerCase()
            if (type === "hidden" || type === "password") continue
            for (const attribute of ["value", "placeholder"]) {
                const value = node.attributes.get(attribute)
                if (value) copy.push({ text: value, node })
            }
        }
    }
    return copy
}

// A banned word and the forms of it the policy means: "explore" is explored and exploring too, and
// "transform (in any form)" is transformation and transformative
const bannedPattern = (entry: string): RegExp => {
    const word = entry.replace(/\s*\(.*\)$/, "").toLowerCase()
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    let body: string
    if (/\(in any form\)/.test(entry)) body = `${escape(word)}\\w*`
    else if (word.includes(" ")) body = `${escape(word)}s?`
    else if (word.includes("-")) body = escape(word).replace(/\\?-/g, "[- ]")
    else if (word.endsWith("ated")) body = `${escape(word.slice(0, -2))}(?:e|es|ed|ing|ion|ions)`
    else if (word.endsWith("e")) body = `${escape(word.slice(0, -1))}(?:e|es|ed|ing|ely|eness)`
    else if (word.endsWith("ry")) body = `${escape(word.slice(0, -1))}(?:y|ies)`
    else if (word.endsWith("is")) body = `${escape(word.slice(0, -2))}(?:is|es)`
    else body = `${escape(word)}(?:s|es|ed|ing|ly|ness)?`
    return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu")
}

export const BANNED_PATTERNS = BANNED_COPY_WORDS.map((entry) => ({ word: entry.replace(/\s*\(.*\)$/, ""), pattern: bannedPattern(entry) }))

const copyIssues = (copy: Copy[], context: ValidationContext): Issue[] => {
    const issues: Issue[] = []
    for (const { word, pattern } of BANNED_PATTERNS) {
        // A word the user wrote themselves stays
        if (context.suppliedText && new RegExp(pattern.source, "iu").test(context.suppliedText)) continue
        const hits: { form: string; item: Copy }[] = []
        for (const item of copy) {
            for (const match of item.text.matchAll(pattern)) hits.push({ form: match[0], item })
        }
        if (hits.length === 0) continue
        const first = hits[0]
        issues.push({
            kind: "copy",
            severity: "error",
            key: `copy|${word}`,
            count: hits.length,
            message: `Banned word ${quote(first.form)}${places(hits.length)}: ${quote(first.item.text)} in ${where(first.item.node)}. Say it plainly instead, as the copy policy asks.`,
        })
    }
    return issues
}

// Common given names that aren't also ordinary words (no Will, Mark, Grace, May, Rose or Max)
const FIRST_NAMES = new Set(`
    aaron adam adrian adriana ahmed aisha alan albert alejandra alejandro alex alexander alexandra ali alice alicia amanda amelia amy ana
    ananya andre andrea andrew andy angela anna anne anthony antonio anya aria arjun arthur ashley astrid audrey ava barbara beatriz ben
    benjamin beth betty bob brandon brenda brian brittany bruce bryan camila carl carla carlos carmen carol caroline catherine charles
    charlotte chiara chloe chris christina christine christopher claire clara colin connor cynthia dan daniel daniela danielle david
    deborah debra denise dennis derek diana diane diego dmitri dominic donald donna doris dorothy douglas dylan edward elena eli elijah
    elizabeth ella ellie emilia emily emma eric ethan eugene evan evelyn fatima felix fernanda fernando francis francisco freya
    gabriel gabriela gary george gerald giulia gloria greg gregory greta hannah hans harold harper harry harvey haruka heidi helen henry
    hiroshi hugo ian ines ingrid irina isaac isabel isabella ivan jacob jacqueline jake james jane janet janice jason javier jeff jeffrey
    jennifer jeremy jesse jessica jim joan joanna joe joel john jon jonathan jorge jose joseph josh joshua juan judith julia julian julie
    justin kai karen karl katherine kathleen kathryn kayla keiko keith kelly kenji kenneth kevin kimberly kristen kyle lars laura lauren
    lawrence layla leah leila leo leon liam linda lisa logan lorenzo louis luca lucas lucia lucy luis luke madison malik manuel marco
    marcus margaret maria mariana marie mario marilyn martha martin mary mateo matt matthew maya megan mei melissa mia michael
    michelle miguel mike milo mohammed monica muhammad nancy natalie natasha nathan nicholas nick nicole nina noah noor nora olga olivia
    omar oscar owen pablo pamela patricia patrick paul paula pedro pete peter philip priya rachel rafael rahul raj ralph ramon randy
    raymond rebecca ricardo richard rita rob robert roberto roger ronald russell ruth ryan sam samantha samuel sandra sara sarah scott
    sean sebastian sergio sharon shirley simon sofia sophia sophie stefan stephanie stephen steve steven susan svetlana sven tatiana
    ted teresa theo theresa thomas tim timothy tom tony tyler valentina vanessa veronica victor vincent walter wayne wendy william
    xavier yara yuki yusuf zachary zara zoe
`.trim().split(/\s+/))

// Words after a given name that make it a place or a business, not a person
const NOT_SURNAMES = new Set(["street", "avenue", "road", "lane", "park", "square", "hall", "center", "centre", "university", "college", "school", "hospital", "clinic", "bank", "group", "inc", "ltd", "llc", "studio", "studios", "labs", "cafe", "café", "hotel", "gardens", "garden", "plaza", "tower", "station", "airport", "beach", "lake", "market", "foundation", "institute", "museum", "library", "collection", "plan", "pro", "plus", "office", "offices", "store", "shop", "headquarters", "branch", "campus", "chair", "sofa", "lamp", "table", "bowl", "jar"])

// "Alice Smith", "María García-López", "Sarah K."
const PERSON = /(?<![\p{L}])(\p{Lu}\p{Ll}+)\s+(\p{Lu}\p{Ll}+(?:[-'’]\p{Lu}\p{Ll}+)?|\p{Lu}\.)(?![\p{L}])/gu

const nameIssues = (copy: Copy[], context: ValidationContext): Issue[] => {
    const supplied = (context.suppliedText ?? "").toLowerCase()
    const names = new Map<string, Copy>()
    for (const item of copy) {
        for (const match of item.text.matchAll(PERSON)) {
            const [whole, first, last] = match
            // María is Maria to the list
            const given = first.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
            // "Sarah Lawrence College" is a place, by the word after the name as much as in it
            const next = /^\s+(\p{L}+)/u.exec(item.text.slice((match.index ?? 0) + whole.length))?.[1]?.toLowerCase()
            if (!FIRST_NAMES.has(given) || NOT_SURNAMES.has(last.toLowerCase()) || (next && NOT_SURNAMES.has(next))) continue
            if (supplied.includes(whole.toLowerCase())) continue
            if (!names.has(whole)) names.set(whole, item)
        }
    }
    if (names.size === 0) return []
    const listed = [...names.keys()].slice(0, 4).map((name) => `"${name}"`)
    const spots = [...new Set([...names.values()].map((item) => nearestId(item.node) ?? describeElement(item.node)))].slice(0, 3)
    return [{
        kind: "name",
        severity: "error",
        key: "name",
        count: names.size,
        message: `Made-up people's names: ${listed.join(", ")}${names.size > 4 ? ` and ${names.size - 4} more` : ""} (in ${spots.join(", ")}). Use roles, initials or labels like "Customer 1" instead, as the copy policy asks.`,
    }]
}

// --- Placeholders ------------------------------------------------------------------------------

const PLACEHOLDER_TEXT: { pattern: RegExp; fix: string }[] = [
    { pattern: /\blorem\b|\bipsum\b|\bdolor sit amet\b/i, fix: "Write real copy, as the copy policy asks." },
    { pattern: /\bplaceholder\b|\b(?:goes|go|will go|will appear|will be shown) here\b/i, fix: "Build the real thing: a chart is bars drawn from divs, with labels." },
    { pattern: /\[[^\]]*\b(?:insert|your|name|company|logo|image|chart|title|text|here|placeholder)\b[^\]]*\]/i, fix: "Write the real words." },
    { pattern: /\b(?:john|jane) doe\b|[\w.+-]+@example\.(?:com|org|net)\b/i, fix: "Use a role or a label instead, as the copy policy asks." },
]

// The box a chart was meant to fill, by its id or class: revenue-chart, chart, chart-area (not chart-bar)
const CHART_BOX = /^(?:[\w-]*-)?(?:chart|graph)(?:-(?:area|container|wrapper|placeholder|box|canvas|panel))?$/i

const placeholderIssues = (page: Page, copy: Copy[], context: ValidationContext): Issue[] => {
    const supplied = context.suppliedText ?? ""
    const groups = new Map<string, { message: string; count: number }>()
    const add = (key: string, message: string) => {
        const group = groups.get(key)
        if (group) group.count++
        else groups.set(key, { message, count: 1 })
    }
    for (const item of copy) {
        for (const { pattern, fix } of PLACEHOLDER_TEXT) {
            const match = pattern.exec(item.text)
            if (!match || pattern.test(supplied)) continue
            add(`placeholder|${match[0].toLowerCase()}`, `Placeholder text ${quote(item.text)} in ${where(item.node)}. ${fix}`)
            break
        }
    }
    for (const node of page.all) {
        if (isWithin(node, NOT_COPY) || page.styles.get(node)?.hidden) continue
        if (node.tag === "canvas") add("placeholder|canvas", `<canvas> in ${where(node)} draws nothing: scripts don't run in the design's frame. Draw the chart as bars from divs, with labels.`)
        const named = [node.attributes.get("id") ?? "", ...node.classes].some((name) => CHART_BOX.test(name))
        if (named && elementChildren(node).length === 0 && !textContent(node) && !/gradient/i.test(node.attributes.get("style") ?? "")) {
            add(`placeholder|empty|${describeElement(node)}`, `Empty chart box ${where(node)}. Draw the chart in it as bars from divs, with labels.`)
        }
    }
    return [...groups.entries()].map(([key, group]) => ({ kind: "placeholder", severity: "error", key, count: group.count, message: `${group.message}${group.count > 1 ? ` (${group.count} places)` : ""}` }))
}

// --- Tables ------------------------------------------------------------------------------------

const normalizeHeader = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()

const singular = (text: string) => text.replace(/s\b/g, "")

const editDistance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index)
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0]
        row[0] = i
        for (let j = 1; j <= b.length; j++) {
            const current = row[j]
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
            previous = current
        }
    }
    return row[b.length]
}

// Two headers that say the same thing: "Status" and "Order status", "Order" and "Orders"
const nearDuplicates = (a: string, b: string) => {
    if (a === b) return false
    const [wordsA, wordsB] = [a.split(" "), b.split(" ")]
    const within = (small: string[], large: string[]) => small.length < large.length && small.every((word) => large.includes(word))
    return singular(a) === singular(b) || within(wordsA, wordsB) || within(wordsB, wordsA) || (Math.min(a.length, b.length) >= 5 && editDistance(a, b) <= 1)
}

const headerCells = (table: HtmlElement) => {
    const rows: HtmlElement[] = []
    const collect = (node: HtmlElement) => {
        for (const child of elementChildren(node)) {
            if (child.tag === "table") continue
            if (child.tag === "tr") rows.push(child)
            else collect(child)
        }
    }
    collect(table)
    const head = rows.find((row) => row.parent?.tag === "thead") ?? rows.find((row) => elementChildren(row).some((cell) => cell.tag === "th"))
    return head ? elementChildren(head).filter((cell) => cell.tag === "th" || cell.tag === "td") : []
}

const tableIssues = (page: Page, context: ValidationContext): Issue[] => {
    const issues: Issue[] = []
    page.all.filter((node) => node.tag === "table").forEach((table, index) => {
        const label = nearestId(table) ?? `${index + 1}`
        const headers = headerCells(table).map((cell) => ({ text: textContent(cell), normal: normalizeHeader(textContent(cell)) })).filter((header) => header.normal)
        const seen = new Map<string, number>()
        for (const header of headers) seen.set(header.normal, (seen.get(header.normal) ?? 0) + 1)
        for (const [normal, times] of seen) {
            if (times < 2) continue
            const text = headers.find((header) => header.normal === normal)!.text
            issues.push({ kind: "duplicate-column", severity: "error", key: `duplicate-column|${normal}`, count: times, message: `Table ${label} has the column ${quote(text)} ${times === 2 ? "twice" : `${times} times`}. Keep one, and drop the others from the header and every row.` })
        }
        if (context.mode !== "refine") return
        const unique = [...new Map(headers.map((header) => [header.normal, header])).values()]
        for (let i = 0; i < unique.length; i++) {
            for (let j = i + 1; j < unique.length; j++) {
                if (!nearDuplicates(unique[i].normal, unique[j].normal)) continue
                const pair = [unique[i].normal, unique[j].normal].sort()
                issues.push({ kind: "duplicate-column", severity: "error", key: `duplicate-column|${pair.join("|")}`, count: 1, message: `Table ${label} has the columns ${quote(unique[i].text)} and ${quote(unique[j].text)}, which say the same thing. Keep one, and drop the other from the header and every row.` })
            }
        }
    })
    return issues
}

// --- Images ------------------------------------------------------------------------------------

// A box that keeps its size without its image: an aspect ratio, or a height that isn't a percentage
const holdsSize = (values: Map<string, string>) => {
    const aspect = values.get("aspect-ratio")?.trim().toLowerCase()
    if (aspect && aspect !== "auto") return true
    return ["height", "min-height"].some((property) => {
        const value = values.get(property)?.trim().toLowerCase()
        return Boolean(value && /^(?:calc\(|clamp\(|min\(|max\()?[\d.]+(px|rem|em|vh|svh|dvh|lvh)\b/.test(value) && parseFloat(value.replace(/^[a-z]+\(/, "")) > 0)
    })
}

const imageIssues = (page: Page): Issue[] => {
    const issues: Issue[] = []
    for (const node of page.all) {
        if (node.tag !== "img" || isWithin(node, new Set(["svg", "math"])) || page.styles.get(node)?.hidden) continue
        const own = page.styles.get(node)!.values
        const attributeSize = ["width", "height"].every((name) => Number.parseFloat(node.attributes.get(name) ?? "") > 0)
        if (holdsSize(own) || attributeSize) continue
        // Its box keeps the space even if it's empty
        const boxes = [node.parent, node.parent?.parent].filter((box): box is HtmlElement => Boolean(box && box.tag !== ROOT))
        if (boxes.some((box) => holdsSize(page.styles.get(box)!.values))) continue
        const alt = node.attributes.get("alt") ?? ""
        issues.push({
            kind: "image-size",
            severity: "error",
            key: `image-size|${alt}|${node.attributes.get("data-slot") ?? ""}`,
            count: 1,
            message: `${where(node)} has no height or aspect ratio, so it collapses to nothing when the image doesn't load. Give its box an aspect-[w/h] class (the slot's shape) with c-muted-bg behind it.`,
        })
    }
    return issues
}

// --- Inline SVG --------------------------------------------------------------------------------

const svgIssues = (page: Page): Issue[] => {
    const svgs = page.all.filter((node) => (node.tag === "svg" || node.tag === "math") && !isWithin(node.parent, new Set(["svg", "math"])))
    if (svgs.length === 0) return []
    const spots = [...new Set(svgs.map((node) => nearestId(node.parent) ?? describeElement(node.parent!)))].slice(0, 3)
    return [{
        kind: "inline-svg",
        severity: "error",
        key: "inline-svg",
        count: svgs.length,
        message: `${svgs.length} inline <svg>${svgs.length === 1 ? "" : "s"} (in ${spots.join(", ")}): the design's frame removes inline SVG, so ${svgs.length === 1 ? "it shows" : "they show"} as nothing. Use a short text label or a plain Unicode symbol (→ ✓ ✕ •) for each icon, and draw any chart from divs.`,
    }]
}

// --- Checking a design -------------------------------------------------------------------------

const findIssues = (html: string, contract: DesignContract, context: ValidationContext): Issue[] => {
    const page = readPage(html, context.width ?? DEFAULT_FRAME_WIDTH)
    const copy = copyOf(page)
    return [
        ...contrastIssues(page, contract),
        ...colorIssues(page, contract, context),
        ...copyIssues(copy, context),
        ...nameIssues(copy, context),
        ...placeholderIssues(page, copy, context),
        ...tableIssues(page, context),
        ...imageIssues(page),
        ...svgIssues(page),
    ]
}

// Every problem the checks find in a design, errors and warnings. With context.previousHtml, a problem
// the earlier page already had, as often, is a warning: only what this version brought in is an error.
export const validate = (html: string, contract: DesignContract, context: ValidationContext = {}): Issue[] => {
    const issues = findIssues(html, contract, context)
    if (!context.previousHtml) return issues
    const earlier = new Map(findIssues(context.previousHtml, contract, { ...context, previousHtml: undefined }).map((issue) => [issue.key, issue]))
    return issues.map((issue) => {
        const before = earlier.get(issue.key)
        return before && before.count >= issue.count && issue.severity === "error" ? { ...issue, severity: "warning", message: `${issue.message} (It was already there.)` } : issue
    })
}

export const errorCount = (issues: Issue[]) => issues.filter((issue) => issue.severity === "error").length

// The errors as the repair request lists them, one per line, most important first
export const REPAIR_LIST_LIMIT = 20

const KIND_ORDER: IssueKind[] = ["contrast", "duplicate-column", "image-size", "inline-svg", "placeholder", "name", "copy", "color"]

export const repairProblems = (issues: Issue[]) => {
    const errors = issues
        .filter((issue) => issue.severity === "error")
        .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    const listed = errors.slice(0, REPAIR_LIST_LIMIT).map((issue) => issue.message)
    if (errors.length > REPAIR_LIST_LIMIT) listed.push(`And ${errors.length - REPAIR_LIST_LIMIT} more problems of the kinds above.`)
    return listed
}

// Counts for a log line, with none of the page's words in it
export const issueSummary = (issues: Issue[]) => ({
    errors: errorCount(issues),
    warnings: issues.length - errorCount(issues),
    kinds: Object.fromEntries(KIND_ORDER.map((kind) => [kind, issues.filter((issue) => issue.kind === kind && issue.severity === "error").length]).filter(([, count]) => count)),
})
