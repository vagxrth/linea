import z from "zod"

// A frame's wireframe as structured data: every box, image slot, circle, text and stroke, nested
// inside the box around it, in reading order. The canvas builds it (src/lib/frame-outline.ts) and
// sends it with the frame's picture; the generate routes check it, cut it down if it's too long, and
// write it out as text for the prompt. Each node keeps its canvas shape's id, so the design can mark
// what it built from which shape, and a later refine can find it again.

export const OUTLINE_VERSION = 1

// How many nodes the prompt lists. Whole top-level rows are kept or dropped together, so a row of
// cards never loses its last card.
export const MAX_OUTLINE_NODES = 120

export type OutlineKind = "box" | "image" | "circle" | "text" | "line" | "arrow" | "scribble"

export type OutlineNode = {
    id: string
    kind: OutlineKind
    // A component's name written on the canvas ("card", "navbar"): it says what to build, and never
    // appears on the page
    label?: string
    // Words written on the canvas for the page to show, as they are
    text?: string
    // Left, top, right and bottom, as a percent of the frame
    box: [number, number, number, number]
    children?: OutlineNode[]
}

export type OutlineTruncation = {
    totalNodes: number
    listedNodes: number
    // Top-level rows left out entirely, and where the first of them starts (percent down the frame)
    omittedRows: number
    fromY: number | null
    // Whether a row was too big to list whole and lost some of its nested items instead
    partialRow: boolean
}

export type FrameOutline = {
    version: number
    frame: { id: string; number: number; width: number; height: number }
    nodes: OutlineNode[]
    truncated?: OutlineTruncation
}

// --- Labels and copy --------------------------------------------------------------------------

// Words people write on a wireframe to name a component rather than to put on the page
const COMPONENT_WORDS = new Set([
    "navbar", "nav", "navigation", "menu", "header", "logo", "hero", "banner", "image", "img", "picture", "photo",
    "video", "icon", "avatar", "button", "btn", "cta", "link", "links", "card", "cards", "tile", "footer", "sidebar",
    "panel", "form", "input", "field", "search", "testimonial", "testimonials", "review", "reviews", "price",
    "quote", "chart", "graph", "table", "list", "grid", "gallery", "section", "feature", "features", "headline",
    "heading", "title", "subtitle", "subheading", "text", "paragraph", "copy", "body", "caption", "label", "tag",
    "badge", "map", "modal", "dialog", "tab", "tabs", "toggle", "checkbox", "dropdown", "select", "newsletter",
    "stats", "stat", "metric", "metrics", "kpi", "content", "placeholder", "description", "filter", "filters",
    "pagination", "breadcrumb", "breadcrumbs", "toolbar", "divider", "slider", "carousel", "timeline", "thumbnail",
    "name", "date", "email", "password", "phone", "address", "total", "quantity",
])
// Words that can sit beside them in a name ("main image", "card 2", "pricing table"), but alone are
// more likely the page's own words: a navbar's "Pricing" or "About" is a link to show
const NAME_WORDS = new Set([
    "main", "big", "large", "small", "primary", "secondary", "top", "bottom", "left", "right", "new", "the", "a",
    "of", "and", "with", "here", "goes", "area", "box", "block", "slot", "bar", "group", "row", "x",
    "pricing", "about", "contact", "blog", "home", "faq", "team", "shop", "services", "product", "products", "plan", "plans",
])

// Whether text written on the canvas names a component ("hero image", "card 2") rather than being
// copy for the page ("Fresh plants every week"). Copy keeps its words; a name never shows.
export const isComponentLabel = (text: string) => {
    const tokens = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean)
    if (tokens.length === 0 || tokens.length > 4) return false
    return tokens.some((token) => COMPONENT_WORDS.has(token)) &&
        tokens.every((token) => COMPONENT_WORDS.has(token) || NAME_WORDS.has(token) || /^\d+$/.test(token))
}

// --- Reading order ----------------------------------------------------------------------------

type Positioned = { box: [number, number, number, number] }

// Rows from the top, left to right within a row. Items share a row when the next one's middle is
// above the bottom of the row so far.
export const readingRows = <T extends Positioned>(items: T[]): T[][] => {
    const sorted = [...items].sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0])
    const result: T[][] = []
    let bottom = -Infinity
    for (const item of sorted) {
        const middle = (item.box[1] + item.box[3]) / 2
        if (result.length && middle < bottom) {
            result[result.length - 1].push(item)
            bottom = Math.max(bottom, item.box[3])
        } else {
            result.push([item])
            bottom = item.box[3]
        }
    }
    return result.map((row) => row.sort((a, b) => a.box[0] - b.box[0]))
}

// A row's columns, left to right, each read top to bottom. Items whose left edges are within a few
// percent share a column: a hand-drawn column's edges are never quite straight.
const readingColumns = <T extends Positioned>(row: T[]): T[][] => {
    const result: T[][] = []
    let start = -Infinity
    for (const item of [...row].sort((a, b) => a.box[0] - b.box[0])) {
        if (item.box[0] - start > 4) {
            result.push([])
            start = item.box[0]
        }
        result[result.length - 1].push(item)
    }
    return result.map((column) => column.sort((a, b) => a.box[1] - b.box[1]))
}

// --- Size limit -------------------------------------------------------------------------------

export const countNodes = (nodes: OutlineNode[]): number =>
    nodes.reduce((total, node) => total + 1 + countNodes(node.children ?? []), 0)

// The nodes that fit in `budget`, a whole row at a time. When even the first row doesn't fit, its
// nodes stay and their own children are fitted the same way, so a page drawn inside one big box
// still lists its top.
const fit = (nodes: OutlineNode[], budget: number): { kept: OutlineNode[]; used: number; omittedRows: number; fromY: number | null; partial: boolean } => {
    const rowsOf = readingRows(nodes)
    const kept: OutlineNode[] = []
    let used = 0
    for (let index = 0; index < rowsOf.length; index++) {
        const row = rowsOf[index]
        const size = countNodes(row)
        if (used + size <= budget) {
            kept.push(...row)
            used += size
            continue
        }
        if (kept.length === 0) {
            for (const node of row) {
                if (used + 1 > budget) break
                const inner = fit(node.children ?? [], budget - used - 1)
                kept.push({ ...node, children: inner.kept })
                used += 1 + inner.used
            }
            const rest = rowsOf.slice(index + 1)
            return { kept, used, omittedRows: rest.length, fromY: rest[0] ? Math.min(...rest[0].map((node) => node.box[1])) : null, partial: true }
        }
        const rest = rowsOf.slice(index)
        return { kept, used, omittedRows: rest.length, fromY: Math.min(...row.map((node) => node.box[1])), partial: false }
    }
    return { kept, used, omittedRows: 0, fromY: null, partial: false }
}

// The outline cut down to `budget` nodes, saying what it left out. An outline that fits comes back
// as it is, and one that was cut keeps the larger counts it was cut from.
export const truncateOutline = (outline: FrameOutline, budget = MAX_OUTLINE_NODES): FrameOutline => {
    const total = Math.max(countNodes(outline.nodes), outline.truncated?.totalNodes ?? 0)
    const result = fit(outline.nodes, budget)
    if (result.omittedRows === 0 && !result.partial) return outline
    return {
        ...outline,
        nodes: result.kept,
        truncated: {
            totalNodes: total,
            listedNodes: result.used,
            omittedRows: result.omittedRows + (outline.truncated?.omittedRows ?? 0),
            fromY: result.fromY ?? outline.truncated?.fromY ?? null,
            partialRow: result.partial || (outline.truncated?.partialRow ?? false),
        },
    }
}

// --- Checking an outline from a request -------------------------------------------------------

const percent = z.number().finite().min(-5).max(105)

const NodeSchema: z.ZodType<OutlineNode> = z.lazy(() =>
    z.object({
        id: z.string().min(1).max(64),
        kind: z.enum(["box", "image", "circle", "text", "line", "arrow", "scribble"]),
        label: z.string().max(80).optional(),
        text: z.string().max(200).optional(),
        box: z.tuple([percent, percent, percent, percent]),
        children: z.array(NodeSchema).max(200).optional(),
    })
)

const OutlineSchema = z.object({
    version: z.number().int(),
    frame: z.object({ id: z.string().max(64), number: z.number().int().min(0), width: z.number().positive().max(100_000), height: z.number().positive().max(100_000) }),
    nodes: z.array(NodeSchema).max(400),
    truncated: z.object({
        totalNodes: z.number().int().min(0),
        listedNodes: z.number().int().min(0),
        omittedRows: z.number().int().min(0),
        fromY: z.number().nullable(),
        partialRow: z.boolean(),
    }).optional(),
})

const depth = (nodes: OutlineNode[]): number => nodes.reduce((deepest, node) => Math.max(deepest, 1 + depth(node.children ?? [])), 0)

// Requests cap their body, but the outline is the canvas's word, so it's checked before the prompt
// uses it: the shape, at most 400 nodes, 8 levels deep. Too long, it's cut to MAX_OUTLINE_NODES.
export const parseOutline = (raw: string): FrameOutline | null => {
    let value: unknown
    try {
        value = JSON.parse(raw)
    } catch {
        return null
    }
    const parsed = OutlineSchema.safeParse(value)
    if (!parsed.success) return null
    const outline = parsed.data as FrameOutline
    if (countNodes(outline.nodes) > 400 || depth(outline.nodes) > 8) return null
    return truncateOutline(outline)
}

// --- As prompt text ---------------------------------------------------------------------------

const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)))

const where = ({ box }: OutlineNode) => {
    const span = (from: number, to: number) => (Math.round(from) === Math.round(to) ? `${clamp(from)}` : `${clamp(from)}–${clamp(to)}`)
    return `x ${span(box[0], box[2])}%, y ${span(box[1], box[3])}%`
}

const quoted = (value: string) => JSON.stringify(value)

// Width over height of a node's box, in the frame's own pixels
export const aspectRatio = (node: OutlineNode, frame: FrameOutline["frame"]) => {
    const width = ((node.box[2] - node.box[0]) / 100) * frame.width
    const height = ((node.box[3] - node.box[1]) / 100) * frame.height
    return height > 0 ? Math.round((width / height) * 100) / 100 : 1
}

const describe = (node: OutlineNode, frame: FrameOutline["frame"]) => {
    const label = node.label ? ` ${quoted(node.label)}` : ""
    const id = ` [${node.id}]`
    switch (node.kind) {
        case "box": return `box${label}${id}, ${where(node)}`
        case "image": return `image slot${label}${id}, ${where(node)}, aspect ${aspectRatio(node, frame)}`
        case "circle": return `circle${label}${id}, ${where(node)}`
        // Only where it starts: a label's own size says nothing about how big the text it stands for is
        case "text": return node.text !== undefined
            ? `copy ${quoted(node.text)}${id}, at x ${clamp(node.box[0])}%, y ${clamp(node.box[1])}%`
            : `text${label}${id} (a component's name), at x ${clamp(node.box[0])}%, y ${clamp(node.box[1])}%`
        case "line": return `line${id}, ${where(node)}`
        case "arrow": return `arrow${id}, ${where(node)}`
        case "scribble": return `scribble${id}, ${where(node)}`
    }
}

// Whether the boxes are about the same size, like a row of cards, rather than a hero's button and image
const alike = (nodes: OutlineNode[]) => {
    const size = (node: OutlineNode) => [node.box[2] - node.box[0], node.box[3] - node.box[1]]
    const [width, height] = size(nodes[0])
    return nodes.every((node) => {
        const [w, h] = size(node)
        return Math.abs(w - width) <= width * 0.35 && Math.abs(h - height) <= height * 0.35
    })
}

const span = (nodes: OutlineNode[]) =>
    `x ${clamp(Math.min(...nodes.map((node) => node.box[0])))}–${clamp(Math.max(...nodes.map((node) => node.box[2])))}%`

const write = (nodes: OutlineNode[], depthOf: number, frame: FrameOutline["frame"], lines: string[]) => {
    const indent = "  ".repeat(depthOf)
    const item = (node: OutlineNode, at: number) => {
        lines.push(`${"  ".repeat(at)}- ${describe(node, frame)}`)
        write(node.children ?? [], at + 1, frame, lines)
    }
    for (const row of readingRows(nodes)) {
        const boxes = row.filter((node) => node.kind === "box" || node.kind === "image" || node.kind === "circle")
        const parts = readingColumns(row)
        if (boxes.length > 1 && alike(boxes)) {
            // Repeated boxes side by side, like cards, so the design keeps the row and its count
            lines.push(`${indent}- row of ${boxes.length} side by side:`)
            parts.flat().forEach((node) => item(node, depthOf + 1))
        } else if (parts.length > 1 && parts.some((column) => column.length > 1)) {
            // A stack beside something else, like a hero's text beside its image: columns, so the
            // design doesn't stack them
            lines.push(`${indent}- ${parts.length} columns side by side:`)
            for (const column of parts) {
                lines.push(`${indent}  - column, ${span(column)}:`)
                column.forEach((node) => item(node, depthOf + 2))
            }
        } else {
            parts.flat().forEach((node) => item(node, depthOf))
        }
    }
}

// The outline as the prompt lists it, ending with what it leaves out when it was cut short
export const outlineText = (outline: FrameOutline) => {
    const { frame } = outline
    const shape = frame.width >= frame.height ? "landscape" : "portrait"
    const lines = [
        `Frame ${frame.number}: ${Math.round(frame.width)} × ${Math.round(frame.height)} px, ${shape}. Positions are percent of the frame, x across and y down; indented items sit inside the box above them. [id] is the canvas shape each item comes from.`,
    ]
    write(outline.nodes, 0, frame, lines)
    const cut = outline.truncated
    if (cut) {
        const rows = cut.omittedRows > 0 ? `${cut.omittedRows} top-level row${cut.omittedRows === 1 ? "" : "s"}${cut.fromY !== null ? ` from y ${clamp(cut.fromY)}% down` : ""}` : ""
        const partial = cut.partialRow ? "some items nested inside the listed boxes" : ""
        lines.push(
            `OUTLINE INCOMPLETE: it lists ${cut.listedNodes} of ${cut.totalNodes} items. Not listed: ${[rows, partial].filter(Boolean).join(", and ")}. Build those parts from the wireframe image, in the same style.`
        )
    }
    return lines.join("\n")
}

// --- Image slots ------------------------------------------------------------------------------

export type OutlineImageSlot = { node: string; label?: string; aspectRatio: number; box: [number, number, number, number] }

// The outline's crossed boxes, in reading order, with their shape
export const outlineImageSlots = (outline: FrameOutline): OutlineImageSlot[] => {
    const slots: OutlineImageSlot[] = []
    const visit = (nodes: OutlineNode[]) => {
        for (const row of readingRows(nodes)) {
            for (const node of row) {
                if (node.kind === "image") slots.push({ node: node.id, label: node.label, aspectRatio: aspectRatio(node, outline.frame), box: node.box })
                visit(node.children ?? [])
            }
        }
    }
    visit(outline.nodes)
    return slots
}
